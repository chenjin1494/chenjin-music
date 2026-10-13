<#
.SYNOPSIS
Queries or controls actual Windows SMTC sessions using WinRT (Windows PowerShell 5.1).
.DESCRIPTION
Writes one JSON object to stdout. Timeline values and -Seconds use seconds.
Control actions require exactly one session matching -ExpectedTitle and/or -AppId
(case-sensitive, exact equality; both selectors must match when both are supplied).
No current-session fallback is used. Exit code 1 indicates an error or rejected action.
A successful native request does not guarantee the renderer has updated yet; poll query
and assert the application's state separately in the Electron test.
.EXAMPLE
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/windows-media-session.ps1
.EXAMPLE
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/windows-media-session.ps1 -Action pause -ExpectedTitle "SMTC fixture unique marker"
.EXAMPLE
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File scripts/windows-media-session.ps1 -Action seek -ExpectedTitle "SMTC fixture unique marker" -Seconds 12.5
#>
[CmdletBinding()]
param(
    [ValidateSet('query', 'pause', 'play', 'next', 'previous', 'seek')]
    [string] $Action = 'query',
    [string] $ExpectedTitle,
    [Alias('ExpectedAppId', 'SourceAppId')]
    [string] $AppId,
    [double] $Seconds = [double]::NaN,
    [ValidateRange(1, 120000)]
    [int] $TimeoutMs = 10000
)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$ProgressPreference = 'SilentlyContinue'

try {
    if ($PSVersionTable.PSEdition -ne 'Desktop') {
        throw 'Run this probe with Windows PowerShell 5.1 (powershell.exe), not pwsh.'
    }
    if ($Action -ne 'query' -and [string]::IsNullOrEmpty($ExpectedTitle) -and [string]::IsNullOrEmpty($AppId)) {
        throw 'A control action requires -ExpectedTitle or -AppId to avoid controlling another application.'
    }
    if ($Action -eq 'seek' -and ([double]::IsNaN($Seconds) -or [double]::IsInfinity($Seconds) -or $Seconds -lt 0 -or $Seconds -gt ([long]::MaxValue / 10000000.0))) {
        throw '-Seconds must be a finite, nonnegative seek position representable in Windows ticks.'
    }

    Add-Type -AssemblyName System.Runtime.WindowsRuntime
    $managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
    $propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]
    $script:asTaskMethod = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
        $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and
        $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and
        $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
    } | Select-Object -First 1
    if ($null -eq $script:asTaskMethod) { throw 'Could not locate WinRT IAsyncOperation<T> AsTask bridge.' }

    function Wait-WinRtOperation {
        param($Operation, [Type] $ResultType)
        $method = $script:asTaskMethod.MakeGenericMethod(@($ResultType))
        $task = $method.Invoke($null, @($Operation))
        if (-not $task.Wait($TimeoutMs)) {
            throw "WinRT operation timed out after $TimeoutMs ms."
        }
        return $task.Result
    }

    function Get-SessionSnapshot {
        param($Session)
        $properties = Wait-WinRtOperation -Operation ($Session.TryGetMediaPropertiesAsync()) -ResultType $propertiesType
        $playback = $Session.GetPlaybackInfo()
        $timeline = $Session.GetTimelineProperties()
        return [pscustomobject][ordered]@{
            sourceAppId = $Session.SourceAppUserModelId
            title = $properties.Title
            artist = $properties.Artist
            album = $properties.AlbumTitle
            playbackStatus = $playback.PlaybackStatus.ToString()
            timeline = [pscustomobject][ordered]@{
                position = $timeline.Position.TotalSeconds
                start = $timeline.StartTime.TotalSeconds
                end = $timeline.EndTime.TotalSeconds
            }
        }
    }

    $manager = Wait-WinRtOperation -Operation ($managerType::RequestAsync()) -ResultType $managerType
    $entries = @(
        foreach ($session in $manager.GetSessions()) {
            [pscustomobject]@{ native = $session; snapshot = (Get-SessionSnapshot -Session $session) }
        }
    )
    $matches = @($entries | Where-Object {
        ([string]::IsNullOrEmpty($ExpectedTitle) -or $_.snapshot.title -ceq $ExpectedTitle) -and
        ([string]::IsNullOrEmpty($AppId) -or $_.snapshot.sourceAppId -ceq $AppId)
    })
    $actionResult = $null
    if ($Action -ne 'query') {
        if ($matches.Count -ne 1) {
            throw "Expected exactly one matching native media session; found $($matches.Count)."
        }
        $target = $matches[0]
        # Verify the title again immediately before sending a command; a track can change
        # while other sessions' metadata is being fetched.
        $before = Get-SessionSnapshot -Session $target.native
        if (-not [string]::IsNullOrEmpty($ExpectedTitle) -and $before.title -cne $ExpectedTitle) {
            throw 'The target title changed before the control action; no command was sent.'
        }
        $operation = switch ($Action) {
            'pause' { $target.native.TryPauseAsync() }
            'play' { $target.native.TryPlayAsync() }
            'next' { $target.native.TrySkipNextAsync() }
            'previous' { $target.native.TrySkipPreviousAsync() }
            'seek' { $target.native.TryChangePlaybackPositionAsync([long][Math]::Round($Seconds * 10000000.0)) }
        }
        $accepted = Wait-WinRtOperation -Operation $operation -ResultType ([bool])
        $actionResult = [pscustomobject][ordered]@{
            action = $Action
            accepted = [bool]$accepted
            sourceAppId = $before.sourceAppId
            title = $before.title
        }
        if (-not $accepted) { throw "The native session rejected the '$Action' request." }
    }
    [pscustomobject][ordered]@{
        success = $true
        sessions = @($entries | ForEach-Object { $_.snapshot })
        actionResult = $actionResult
    } | ConvertTo-Json -Depth 6 -Compress
}
catch {
    [pscustomobject][ordered]@{
        success = $false
        error = $_.Exception.Message
        sessions = @($entries | Where-Object { $null -ne $_ } | ForEach-Object { $_.snapshot })
        actionResult = $actionResult
    } | ConvertTo-Json -Depth 6 -Compress
    exit 1
}
