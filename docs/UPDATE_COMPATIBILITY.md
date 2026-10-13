# 独立更新服务兼容性验证

更新源采用琛瑾音乐独立 manifest，不使用上游更新频道。生产只允许HTTPS，开发本机HTTP用于fixture；SHA-512仅说明数据完整性，不能替代发布者签名验证。本次未配置真实远端发布URL，未执行真正的安装程序，不能宣称生产远程升级已验证。

- SemVer支持预发布标识顺序，忽略build元数据；无效版本拒绝。
- 清单最多1MB、32个唯一平台/架构安装包，安装包最多1GB；hash格式、声明长度与最终hash全部验证。
- 网络跳转禁自动跟随，若Electron返回跳转响应则逐跳检查协议；当前Electron拒绝manual跳转时明确要求直接HTTPS地址；清单15秒超时，下载安装30秒无数据超时；检查/下载/安装互斥，取消立即清空ready。
- 下载采用随机独立.partial临时路径、完整校验后原子rename；失败清理仅本次partial，不删除用户或其他安装包。
- 安装前重新核对大小和hash；Windows仅.exe且MZ/PE标识，spawn error被捕获并reject；macOS仅.dmg/.pkg，Linux仅.AppImage。
- 可用安装包不代表发布者可信；本服务未声明完成代码签名验证。

## 真实探测结果

```json
{
  "time": "2026-10-12T21:35:06.602Z",
  "platform": "win32",
  "arch": "x64",
  "mode": "real Electron main+IPC, isolated USER_DATA, temporary loopback HTTP fixtures",
  "checks": [
    {
      "name": "语义版本 0.0.9",
      "ok": true,
      "ms": 146,
      "detail": {
        "available": false,
        "version": "0.0.9",
        "currentVersion": "0.1.0",
        "releaseNotes": "本机 fixture，未执行真实安装器",
        "supported": true,
        "message": "已是最新版本"
      }
    },
    {
      "name": "语义版本 0.1.0",
      "ok": true,
      "ms": 7,
      "detail": {
        "available": false,
        "version": "0.1.0",
        "currentVersion": "0.1.0",
        "releaseNotes": "本机 fixture，未执行真实安装器",
        "supported": true,
        "message": "已是最新版本"
      }
    },
    {
      "name": "语义版本 1.0.0",
      "ok": true,
      "ms": 7,
      "detail": {
        "available": true,
        "version": "1.0.0",
        "currentVersion": "0.1.0",
        "releaseNotes": "本机 fixture，未执行真实安装器",
        "supported": true,
        "message": "有可用更新"
      }
    },
    {
      "name": "语义版本 0.1.0-beta.1",
      "ok": true,
      "ms": 6,
      "detail": {
        "available": false,
        "version": "0.1.0-beta.1",
        "currentVersion": "0.1.0",
        "releaseNotes": "本机 fixture，未执行真实安装器",
        "supported": true,
        "message": "已是最新版本"
      }
    },
    {
      "name": "真实流下载SHA-512/大小/ready/progress",
      "ok": true,
      "ms": 165,
      "detail": {
        "bytes": 524288,
        "events": 3,
        "version": "1.0.0"
      }
    },
    {
      "name": "未知扩展安装拒绝且不运行安装程序",
      "ok": true,
      "ms": 12,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: Windows更新安装包必须为.exe文件"
    },
    {
      "name": "下载 hash 失败并清理partial",
      "ok": true,
      "ms": 136,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 安装包大小或SHA-512校验失败，请重新下载"
    },
    {
      "name": "下载 oversize 失败并清理partial",
      "ok": true,
      "ms": 141,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 安装包超出声明大小"
    },
    {
      "name": "下载 truncated 失败并清理partial",
      "ok": true,
      "ms": 153,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 安装包大小或SHA-512校验失败，请重新下载"
    },
    {
      "name": "并发下载/检查互斥，取消流无ready",
      "ok": true,
      "ms": 146,
      "detail": {
        "error": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 更新下载已取消或网络闲置超时"
      }
    },
    {
      "name": "清单边界 /huge",
      "ok": true,
      "ms": 6,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 版本清单超过1MB限制"
    },
    {
      "name": "清单边界 /invalid",
      "ok": true,
      "ms": 5,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 更新服务未返回有效JSON清单"
    },
    {
      "name": "清单边界 /manifest?case=limit",
      "ok": true,
      "ms": 5,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 安装包大小或地址无效，最大允许1GB"
    },
    {
      "name": "清单边界 /redirect",
      "ok": true,
      "ms": 5,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 更新服务跳转已拒绝，请提供直接HTTPS地址"
    },
    {
      "name": "安装前重验文件篡改",
      "ok": true,
      "ms": 190,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 已下载安装包校验失败，请重新下载"
    },
    {
      "name": "安装spawn error注入捕获（未执行程序）",
      "ok": true,
      "ms": 18,
      "detail": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 无法启动更新安装程序：fixture ENOEXEC"
    }
  ],
  "events": [
    {
      "event": "update.progress",
      "data": {
        "received": 65536,
        "total": 524288,
        "progress": 0.125
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 524288,
        "total": 524288,
        "progress": 1
      }
    },
    {
      "event": "update.ready",
      "data": {
        "path": "C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-update-probe-P08Urx\\userdata\\updates\\chenjin-1.0.0-x64-e8c58d21-c5c6-4a04-9784-dd5352220a20.unsupported",
        "version": "1.0.0"
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 65536,
        "total": 524288,
        "progress": 0.125
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 65536,
        "total": 524287,
        "progress": 0.12500023841903385
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 65536,
        "total": 524289,
        "progress": 0.12499976158187565
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 4096,
        "total": 524288,
        "progress": 0.0078125
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 65536,
        "total": 524288,
        "progress": 0.125
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 524288,
        "total": 524288,
        "progress": 1
      }
    },
    {
      "event": "update.ready",
      "data": {
        "path": "C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-update-probe-P08Urx\\userdata\\updates\\chenjin-1.0.0-x64-f1f7ef0d-c6e3-4239-a45e-070e54cee716.unsupported",
        "version": "1.0.0"
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 128,
        "total": 128,
        "progress": 1
      }
    },
    {
      "event": "update.progress",
      "data": {
        "received": 128,
        "total": 128,
        "progress": 1
      }
    },
    {
      "event": "update.ready",
      "data": {
        "path": "C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-update-probe-P08Urx\\userdata\\updates\\chenjin-1.0.0-x64-7c25c911-316c-41cf-b145-fda29a0fcdd5.exe",
        "version": "1.0.0"
      }
    }
  ],
  "cleanup": {
    "electronClosed": true,
    "httpClosed": true,
    "tempRemoved": true
  },
  "productionRemoteVerified": false,
  "installerExecuted": false
}
```
