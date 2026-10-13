import json, pathlib, zipfile, hashlib, sys
windows_only='--windows-only' in sys.argv
root=pathlib.Path(__file__).resolve().parents[1]
release=root/'release'
version=json.loads((root/'package.json').read_text(encoding='utf-8'))['version']
source=release/f'Chenjin-Music-{version}-Source.zip'
roots=['.github','src','electron','tests','scripts','resources','docs']
files=[root/name for name in ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','electron.vite.config.ts','README.md','LICENSE','THIRD_PARTY_NOTICES.md','appearance.default.json','appearance.example.json','.gitignore']]
for name in roots:
    files.extend(file for file in (root/name).rglob('*') if file.is_file() and '__pycache__' not in file.parts)
# Selected successful evidence; earlier failed diagnostic attempts are not release results.
evidence=['material-packaged-report.json','material-report.json','material-dark.png','material-light.png','material-teal.png','material-settings.png','material-audio.png','windows-media-session-report.json','windows-media-session-packaged-report.json','appearance-report.json','appearance-dark.png','appearance-light.png','appearance-editor.png','settings-report.json','unit-tests.json','e2e-report.json','download-report.json','package-report.json','chenjin-packaged.png','chenjin-light.png','dependency-licenses.json','final-verification.json']
files.extend(root/'artifacts'/name for name in evidence if (root/'artifacts'/name).is_file())
for name in ['linux','performance-2026-10-12T22-34-51-614Z','performance-2026-10-12T22-39-58-522Z','performance-2026-10-12T23-42-53-923Z','deeplink-2026-10-13T00-15-09-929Z','deeplink-2026-10-13T01-04-04-494Z']:
    folder=root/'artifacts'/name
    if folder.exists(): files.extend(file for file in folder.rglob('*') if file.is_file())
with zipfile.ZipFile(source,'w',zipfile.ZIP_DEFLATED,compresslevel=7) as archive:
    for file in sorted(set(files)):
        archive.write(file, 'chenjin-music/'+file.relative_to(root).as_posix())
with zipfile.ZipFile(source) as archive:
    damaged=archive.testzip()
    if damaged: raise RuntimeError('Corrupt archive entry: '+damaged)
    names=archive.namelist()
    assert 'chenjin-music/src/renderer/src/App.vue' in names
    assert 'chenjin-music/THIRD_PARTY_NOTICES.md' in names
    assert not any('/node_modules/' in name or '/release/' in name for name in names)
artifacts=[f'Chenjin-Music-{version}-x64-Setup.exe',f'Chenjin-Music-{version}-x64-Portable.exe']
if not windows_only: artifacts.extend([f'琛瑾音乐-{version}.AppImage',f'chenjin-music_{version}_amd64.deb'])
artifacts.append(source.name)
lines=[]
for name in artifacts:
    file=release/name
    if not file.is_file(): raise RuntimeError('Missing release artifact: '+name)
    digest=hashlib.sha256()
    with file.open('rb') as stream:
        for block in iter(lambda:stream.read(1024*1024),b''): digest.update(block)
    lines.append(digest.hexdigest()+'  '+name)
(release/'SHA256SUMS.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
(release/f'SHA256SUMS-{version}.txt').write_text('\n'.join(lines)+'\n',encoding='utf-8')
print(json.dumps({'archiveEntries':len(names),'archiveCRC':'pass','files':[{'name':name,'bytes':(release/name).stat().st_size} for name in artifacts]},ensure_ascii=False,indent=2))
