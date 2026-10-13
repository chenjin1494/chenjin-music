# 在线平台真实探测记录

采集时间：2026-10-12T21:27:46.901Z → 2026-10-12T21:27:51.935Z。真实 Electron、独立临时 USER_DATA、未登录账户；关键词“周杰伦”，歌曲与歌单搜索 limit=5，专辑/歌手 limit=10。成功仅表示本次公开接口返回真实数据，不表示所有歌曲可播放或所有榜单完整。核心方法经测试专用真实 IPC，新增方法在 Electron 主进程执行同一临时源码 bundle。探测不修改发布构建。

| 能力 | 酷我 | 酷狗 | QQ | 网易 | 咪咕 |
|---|---|---|---|---|---|
| search | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 |
| page2 | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 |
| searchPaging | 有响应  | 有响应  | 有响应  | 有响应  | 有响应  |
| playlists | 有响应 24 | 有响应 30 | 有响应 24 | 有响应 24 | 有响应 30 |
| playlistDetail | 有响应 102 | 有响应 801 | 有响应 66 | 有响应 98 | 有响应 100 |
| boards | 有响应 36 | 有响应 55 | 有响应 25 | 有响应 64 | 有响应 9 |
| boardTracks | 有响应 100 | 有响应 30 | 有响应 100 | 有响应 100 | 有响应 50 |
| lyrics | 有响应 1345 | 有响应 1455 | 有响应 915 | 有响应 1014 | 有响应 1070 |
| comments | 有响应 20 | 不可用：net::ERR_CERT_COMMON_NAME_INVALID | 有响应 20 | 有响应 20 | 有响应 20 |
| hot | 有响应 20 | 有响应 270 | 有响应 30 | 有响应 20 | 不可用：咪咕此版本暂未提供受支持的公开热搜接口 |
| playlistSearch | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 | 有响应 5 |
| tags | 有响应 85 | 不可用：酷狗此公开歌单接口暂不支持标签筛选 | 有响应 65 | 有响应 70 | 有响应 75 |
| taggedPlaylists | 有响应 24 | — | 有响应 24 | 有响应 24 | 有响应 30 |
| playlistsPage2 | 有响应 24 | 有响应 30 | 有响应 24 | 有响应 24 | 有响应 30 |
| playlistPaging | 有响应  | 有响应  | 有响应  | 有响应  | 有响应  |
| newPlaylists | 有响应 24 | — | 有响应 24 | 不可用：平台未返回可用歌单，此发现接口暂不可用 | — |
| suggestions | 有响应 5 | 有响应 5 | 有响应 4 | 有响应 4 | 有响应 5 |
| album | 有响应 10 | 有响应 10 | 有响应 10 | 有响应 10 | 有响应 1 |
| singer | 不可用：此平台的歌手详情未提供受支持的公开接口 | 有响应 10 | 有响应 10 | 有响应 10 | 不可用：此平台的歌手详情未提供受支持的公开接口 |

## 边界与接口

- 酷狗官方评论域名若报证书域名错误，保持 TLS 校验并返回不可用；不会通过禁用证书绕过。
- 酷狗歌单详情使用 mobiles.kugou.com 官方 API 连续页读取并核对 total；榜单网页 API 每页30首。酷我/QQ/咪咕按声明总数读取全部页；网易按trackIds补齐歌曲，不把缺失歌曲当作完整歌单。
- 酷我/咪咕歌手详情未找到原协议公开支持，明确拒绝。咪咕热搜明确未支持。
- configureProxy(proxy) 使用 Electron defaultSession.setProxy；空值使用系统代理，支持HTTP/HTTPS/SOCKS4/SOCKS5，不接受地址中的认证凭据。
- 详情缓存上限200条、5分钟，标签缓存1小时；失败不会缓存。聚合 failures记录逐源失败，全失败拒绝。
- getPlaylists(source,page,tag,sort)；searchPlaylists(source,keyword,page,limit)；getPlaylistTags(source)；getTrackDetails(track)；getAlbum/getSinger(source,id,page,limit)；clearProviderCache()。

## 原始探测摘要及样本

```json
{
  "startedAt": "2026-10-12T21:27:46.901Z",
  "keyword": "周杰伦",
  "environment": {
    "electron": "real desktop",
    "authenticated": false,
    "transport": "latest provider bundle through test-only real IPC handler"
  },
  "sources": {
    "kw": {
      "search": {
        "ok": true,
        "elapsedMs": 363,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "kw_228908",
                "name": "晴天",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "04:29",
                "meta": {
                  "songId": "228908",
                  "albumName": "叶惠美",
                  "albumId": "1293",
                  "singerIds": [
                    "336"
                  ],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "52.83Mb"
                    },
                    {
                      "type": "320k",
                      "size": "10.29Mb"
                    },
                    {
                      "type": "128k",
                      "size": "4.12Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "52.83Mb"
                    },
                    "320k": {
                      "size": "10.29Mb"
                    },
                    "128k": {
                      "size": "4.12Mb"
                    }
                  }
                }
              },
              {
                "id": "kw_118980",
                "name": "夜曲",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "03:46",
                "meta": {
                  "songId": "118980",
                  "albumName": "十一月的萧邦",
                  "albumId": "14466",
                  "singerIds": [
                    "336"
                  ],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "25.45Mb"
                    },
                    {
                      "type": "320k",
                      "size": "8.66Mb"
                    },
                    {
                      "type": "128k",
                      "size": "3.46Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "25.45Mb"
                    },
                    "320k": {
                      "size": "8.66Mb"
                    },
                    "128k": {
                      "size": "3.46Mb"
                    }
                  }
                }
              }
            ]
          },
          "total": 3293,
          "page": 1,
          "limit": 5,
          "source": "kw"
        }
      },
      "playlists": {
        "ok": true,
        "elapsedMs": 357,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "3677150229",
              "source": "kw",
              "name": "国风热歌来袭｜100首诗意旋律",
              "cover": "https://img1.kuwo.cn/star/userpl2015/70/22/1766859167301_224578170_500.jpg",
              "author": "带我走",
              "description": "",
              "playCount": 1024953
            },
            {
              "id": "3677488020",
              "source": "kw",
              "name": "爱的故事翻篇，被爱的人不用道歉",
              "cover": "https://img1.kuwo.cn/star/userpl2015/78/22/1767155386545_224572078_500.jpg",
              "author": "余笑笑",
              "description": "",
              "playCount": 3663287
            }
          ]
        }
      },
      "boards": {
        "ok": true,
        "elapsedMs": 344,
        "value": {
          "count": 36,
          "sample": [
            {
              "id": "16",
              "name": "酷我热歌榜"
            },
            {
              "id": "93",
              "name": "酷我飙升榜"
            }
          ]
        }
      },
      "hot": {
        "ok": true,
        "elapsedMs": 345,
        "value": {
          "count": 20,
          "sample": [
            "无奈的思绪",
            "月亮替我望故乡"
          ]
        }
      },
      "lyrics": {
        "ok": true,
        "elapsedMs": 162,
        "value": {
          "lyric": {
            "characters": 1345,
            "sample": "[00:00.00]晴天 - 周杰伦 (Jay Chou)\n[00:02.25]词：周杰伦\n[00:04.50]曲：周杰伦\n[00:06.75]编曲：周杰伦\n[00:09.00]制作人：周杰伦\n[00:11.25]合声：周杰伦\n[00:13.50]合声编写：周杰伦\n[00:15.75]吉他：蔡科俊Again\n[00:18.00]贝斯：陈任佑\n[00:20.25]鼓：陈柏州\n[00:22.51]录音"
          }
        }
      },
      "comments": {
        "ok": true,
        "elapsedMs": 439,
        "value": {
          "count": 20,
          "sample": [
            {
              "id": "1006165912",
              "author": "空格",
              "avatar": "http://thirdqq.qlogo.cn/ek_qqapp/AQEBFflRuw7lLQtlT0rBV4AIH3shkH3LjGUibKlm623GLrfURibKVPOoJms5ZS7J7W2sicdticY6kDnEt4UlG4yvcVgicCGAaM5cbJNv1HUKc075grJdCws8/100",
              "text": "周董唱的基本都是爱情故事",
              "time": "2026/10/11 23:40:37",
              "likes": 0
            },
            {
              "id": "1006165158",
              "author": "周杰倫",
              "avatar": "http://img1.kuwo.cn/star/userhead/47/12/1791638875612_620191947s.jpg",
              "text": "那天下雨了",
              "time": "2026/10/11 22:32:49",
              "likes": 0
            }
          ]
        }
      },
      "page2": {
        "ok": true,
        "elapsedMs": 76,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "kw_94237",
                "name": "七里香",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "04:59",
                "meta": {
                  "songId": "94237",
                  "albumName": "七里香",
                  "albumId": "4533",
                  "singerIds": [
                    "336"
                  ],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "34.19Mb"
                    },
                    {
                      "type": "320k",
                      "size": "11.42Mb"
                    },
                    {
                      "type": "128k",
                      "size": "4.57Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "34.19Mb"
                    },
                    "320k": {
                      "size": "11.42Mb"
                    },
                    "128k": {
                      "size": "4.57Mb"
                    }
                  }
                }
              },
              {
                "id": "kw_94239",
                "name": "搁浅",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "04:00",
                "meta": {
                  "songId": "94239",
                  "albumName": "七里香",
                  "albumId": "4533",
                  "singerIds": [
                    "336"
                  ],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "24.96Mb"
                    },
                    {
                      "type": "320k",
                      "size": "9.16Mb"
                    },
                    {
                      "type": "128k",
                      "size": "3.67Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "24.96Mb"
                    },
                    "320k": {
                      "size": "9.16Mb"
                    },
                    "128k": {
                      "size": "3.67Mb"
                    }
                  }
                }
              }
            ]
          },
          "total": 3293,
          "page": 2,
          "limit": 5,
          "source": "kw"
        }
      },
      "playlistDetail": {
        "ok": true,
        "elapsedMs": 315,
        "value": {
          "info": {
            "id": "3677150229",
            "source": "kw",
            "name": "国风热歌来袭｜100首诗意旋律",
            "cover": "http://img1.kuwo.cn/star/userpl2015/70/22/1766859167301_224578170_150.jpg",
            "author": "kw2144087549",
            "description": "纵颠沛流离<br>纵世人皆弃<br>唯有一句<br>不悔与君遇<br>图为网源所侵删。",
            "playCount": 1024981
          },
          "tracks": {
            "count": 102,
            "sample": [
              {
                "id": "kw_6304356",
                "name": "牵丝戏",
                "singer": "银临&Aki阿杰",
                "source": "kw",
                "interval": "03:59",
                "meta": {
                  "songId": "6304356",
                  "albumName": "牵丝戏",
                  "albumId": "444778",
                  "singerIds": [],
                  "picUrl": "http://img4.kuwo.cn/star/albumcover/120/6/48/1406239650.jpg",
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "26.02Mb"
                    },
                    {
                      "type": "320k",
                      "size": "9.13Mb"
                    },
                    {
                      "type": "128k",
                      "size": "3.65Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "26.02Mb"
                    },
                    "320k": {
                      "size": "9.13Mb"
                    },
                    "128k": {
                      "size": "3.65Mb"
                    }
                  }
                }
              },
              {
                "id": "kw_3195905",
                "name": "红尘客栈",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "04:34",
                "meta": {
                  "songId": "3195905",
                  "albumName": "十二新作",
                  "albumId": "264333",
                  "singerIds": [],
                  "picUrl": "http://img4.kuwo.cn/star/albumcover/120/s4s17/73/2187216026.jpg",
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "27.2Mb"
                    },
                    {
                      "type": "320k",
                      "size": "10.46Mb"
                    },
                    {
                      "type": "128k",
                      "size": "4.18Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "27.2Mb"
                    },
                    "320k": {
                      "size": "10.46Mb"
                    },
                    "128k": {
                      "size": "4.18Mb"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      "boardTracks": {
        "ok": true,
        "elapsedMs": 490,
        "value": {
          "list": {
            "count": 100,
            "sample": [
              {
                "id": "kw_624683929",
                "name": "山风山风等等我",
                "singer": "万海东",
                "source": "kw",
                "interval": "01:14",
                "meta": {
                  "songId": "624683929",
                  "albumName": "山风山风等等我",
                  "albumId": "97652689",
                  "singerIds": [],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": null
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": null
                    }
                  }
                }
              },
              {
                "id": "kw_567247828",
                "name": "你有没有真的爱过我",
                "singer": "阿图表妹",
                "source": "kw",
                "interval": "02:05",
                "meta": {
                  "songId": "567247828",
                  "albumName": "你有没有真的爱过我",
                  "albumId": "91992117",
                  "singerIds": [],
                  "picUrl": null,
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": null
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": null
                    }
                  }
                }
              }
            ]
          },
          "total": 300,
          "page": 1,
          "limit": 100,
          "source": "kw"
        }
      },
      "playlistSearch": {
        "ok": true,
        "elapsedMs": 71,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "2867496601",
                "source": "kw",
                "name": "终于等到周杰伦，说好不哭你今天哭了吗？",
                "cover": "http://img1.kwcdn.kuwo.cn/star/userpl2015/81/23/1568684821020_182253281_240.jpg",
                "author": "第一天",
                "description": "他来了，他终于带着新歌来了！  周杰伦2019全新单曲 歌名《说好不哭》  9月16日 23点  酷我音乐音源MV同步首播！       /  今年，杰伦40岁了，但我脑海中却还是那个充满个性，说着“可不可以多唱歌少讲话”的男孩子....《说好不哭》其实可能也是杰伦的心里话，可能以后出歌不会像以前那样快了，也在担心自己歌曲是否还能符合粉丝的要求,但说好不哭哦。我相信对于很多粉丝来说，杰伦已经给予了一个完整的音乐海洋，无论伤心快乐，他好像总有为你匹配的歌曲，时时刻刻呵护着自己的情感，即使在各类歌曲百花齐放的今天，每一个夜晚依旧喜欢在他的歌声中入睡。不会哭的，无论过去还是未来，我们还是愿意让你的歌声陪伴着我们，陪伴着整个青春，陪伴一辈子！ ——《说好不哭》热评 当有个人能影响你心情的时候， 说明你在乎了； 当有个人能赚到你眼泪的时候， 说明你投入了， 当有个人能驾驭你情绪的时候， 说明你沦陷了。 能让你笑的人，未必能让你哭 但能让你哭的人，一定还能让你笑 哄你开心的人，未必能深入你的内心； 惹你伤心的人，一定是占据你的心灵 没有疼的爱，称不上爱 真正去爱了， 心才能感觉到什么是疼什么是痛； 不会哭的情，算不上情。 彻底动情了， 你才发现所有的眼泪都是为一人而流。 一次吵架，会让你闷闷不乐 和好以后，又会让你瞬间快乐 次冷落，会让你泪光闪烁； 陪伴以后，又会让你笑容最多。 解铃还须系铃人，心病还须心药医 ——《说好不哭》【风云榜】热评         “我在等你下课哦” “算了，不要我就拉倒吧。” “亲爱的，我们说好不哭的...”",
                "playCount": 0
              },
              {
                "id": "2615213677",
                "source": "kw",
                "name": "『经典』追溯心中回忆“周杰伦”",
                "cover": "http://img1.kwcdn.kuwo.cn/star/userpl2015/84/93/1542827157996_150401784_240.jpg",
                "author": "孤寂之趣",
                "description": "周杰伦音乐专辑，从《JAY》2000年11月1日到2008年10月15日真正留存于我心中记忆中深刻的经典曲目。",
                "playCount": 0
              }
            ]
          },
          "total": 143,
          "page": 1,
          "limit": 5,
          "source": "kw"
        }
      },
      "tags": {
        "ok": true,
        "elapsedMs": 73,
        "value": {
          "count": 85,
          "sample": [
            {
              "id": "211-43",
              "name": "经典老歌专区",
              "group": "专区"
            },
            {
              "id": "87-43",
              "name": "网红专区",
              "group": "专区"
            }
          ]
        }
      },
      "taggedPlaylists": {
        "ok": true,
        "elapsedMs": 95,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "3602662459",
              "source": "kw",
              "name": "准点下班｜邀落日分享情歌温柔",
              "cover": "https://img1.kuwo.cn/star/userpl2015/3/1/1734947414950_546974803_500.jpg",
              "author": "小熊不伤心",
              "description": "",
              "playCount": 6866
            },
            {
              "id": "3680085909",
              "source": "kw",
              "name": "2026短视频热门歌曲合集【精选】",
              "cover": "https://img1.kuwo.cn/star/userpl2015/23/76/1768379343889_135259123_500.jpg",
              "author": "随阳而安",
              "description": "",
              "playCount": 1799558
            }
          ]
        }
      },
      "playlistsPage2": {
        "ok": true,
        "elapsedMs": 61,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "2952935209",
              "source": "kw",
              "name": "焦虑再见！春日活力满满",
              "cover": "https://img1.kuwo.cn/star/userpl2015/15/39/1582015331249_448007115_500.jpg",
              "author": "腾讯音乐人",
              "description": "",
              "playCount": 10353023
            },
            {
              "id": "2823712772",
              "source": "kw",
              "name": "我喜欢你，全世界都不知道",
              "cover": "https://img1.kuwo.cn/star/userpl2015/94/43/1571388433856_264384394_500.jpg",
              "author": "Hawar",
              "description": "",
              "playCount": 10691954
            }
          ]
        }
      },
      "playlistPaging": {
        "ok": true,
        "value": {
          "page1": [
            "3677150229",
            "3677488020",
            "3575766446"
          ],
          "page2": [
            "2952935209",
            "2823712772",
            "2167998336"
          ]
        }
      },
      "newPlaylists": {
        "ok": true,
        "elapsedMs": 56,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "3713111889",
              "source": "kw",
              "name": "那些被999w+人标记“喜欢”的歌",
              "cover": "https://img1.kuwo.cn/star/userpl2015/76/22/1783535739215_224584776_500.jpg",
              "author": "Yin",
              "description": "",
              "playCount": 28827
            },
            {
              "id": "3677105457",
              "source": "kw",
              "name": "伤感：眼泪都留不住你要走的心！",
              "cover": "https://img1.kuwo.cn/star/userpl2015/78/22/1766839196922_224573678_500.jpg",
              "author": "小佳",
              "description": "",
              "playCount": 595878
            }
          ]
        }
      },
      "suggestions": {
        "ok": true,
        "elapsedMs": 66,
        "value": {
          "count": 5,
          "sample": [
            "晴天",
            "夜曲"
          ]
        }
      },
      "details": {
        "ok": true,
        "elapsedMs": 147,
        "value": {
          "id": "kw_228908",
          "name": "晴天",
          "singer": "周杰伦",
          "source": "kw",
          "interval": "04:29",
          "meta": {
            "songId": "228908",
            "albumName": "叶惠美",
            "albumId": "1293",
            "singerIds": [
              "336"
            ],
            "picUrl": "http://img1.kwcdn.kuwo.cn/star/albumcover/500/s3s94/93/211513640.jpg",
            "qualitys": [
              {
                "type": "flac",
                "size": "52.83Mb"
              },
              {
                "type": "320k",
                "size": "10.29Mb"
              },
              {
                "type": "128k",
                "size": "4.12Mb"
              }
            ],
            "_qualitys": {
              "flac": {
                "size": "52.83Mb"
              },
              "320k": {
                "size": "10.29Mb"
              },
              "128k": {
                "size": "4.12Mb"
              }
            }
          }
        }
      },
      "album": {
        "ok": true,
        "elapsedMs": 82,
        "value": {
          "info": {
            "id": "1293",
            "name": "叶惠美",
            "cover": "http://img2.sycdn.kuwo.cn/star/albumcover/240/s3s94/93/211513640.jpg",
            "description": "⊙历经一年企划　引爆市场\n\n近期来说，经济上的不景气，加上这一、两个月来SARS风暴的笼罩阴影影响下，加以盗版、盗拷、MP3的猖獗盛行，引发国内外唱片市场上一片低迷的景象，就国内台湾市场而言，现今发片歌手的销售数字依旧低迷不振，各家唱片公司无不想尽办法来争取消费者的注意，以提升唱片销售数字。在七、八月暑假将至、SARS后期，又是一个唱片市场兵家争夺的时机，想必各家唱片公司必定会推出天王天后来争取这得来不易的大好机会，唱片市场炒热复苏的时机，就在此时。\n\n杰伦2003最新专辑更加不同的是，杰伦对于人文方面的诉求上，加入了更多不同的看法与想法；歌词与音乐巧妙地运用呼应，让你听了有会心一笑的心情；音乐上更是融合复古与现代的巧妙结合，创造出时下流行音乐所没有的新元素，在新专辑推出的同时，定能再创造出另一波周杰伦风潮，也因为对音乐的认真与坚持，杰伦的音乐新思想、音乐新成长，都可以在第四张专辑中听出更不一样的周杰伦。\n\n⊙专辑名称耐人寻味 专辑封面复古特殊有趣\n\n『叶惠美』一个女性的名字？让人匪夷所思、充满问号？？？也充满趣味性，因为第一主打歌为『以父之名』，所以决定以妈妈的名字『叶惠美』为专辑名称。\n\n此次专辑封面加入\"复古\"的元素，穿起复古西装的杰伦依旧不改其帅气的本色，拍出很有感觉的专辑照片，欧洲味加复古风，感觉出很不一样的周杰伦，这次所呈现出来的周杰伦跟以往的周杰伦有些许的不同，唯一没有改变的就是\"帅\"气依旧。视觉上与音乐上都不约而同的加入复古的元素，让音乐与视觉上有更紧密的结合而相互呼应而引发共鸣。封面设计上更加入了一个小小的趣味，封面的照片与其背后墙上的油画竟然是同样一幅画面，提供了消费者无限的想象空间，营造出现在、过去的时空错觉、重迭的感觉。专辑上更打破以往的纪录，收录11首杰伦的好歌，MV也因为歌词音乐意境的表现不同而有不同的表现拍摄方式，意大利教父、学生时代的纯纯恋情、美国华人英雄…等等，都是在听觉上与视觉上支支都精彩、曲曲都动听的专辑CD，相信除了音乐上能给歌迷们更大的满足外，影音上的刺激定可以再创销售奇迹。\n\n⊙超值加赠　满足歌迷\n\n本次专辑歌曲超值收录11首好歌，让歌迷一次拥有，专辑中并同时加赠VCD一片，收录「以父之名」完整MV版、「以父之名」之罗马巡礼、「双刀」电影版MV，让歌迷听的开心、看的过瘾，一次收藏全新的周杰伦。\n\n你看过『教父』这出电影吗？他同时也是杰伦最喜欢的电影之一，为了配合音乐上的视觉表现周杰伦曾有多变的MV造型如航天员、吸血鬼、李小龙以及东隐忍者…等不同的角色诠释，这次在『以父之名』MV中，杰伦化身为意大利教父年代中的杀手身份重回教父的年代，远至意大利实地拍摄，一个意大利的小镇，上演一段惊心动魄的传奇，一间中国餐厅，华人夫妇遭受黑帮的迫害，三岁的小孩被带走，成为教父的义子，在黑帮家庭中长大，过着与常人不同的生活，且看杰伦如何用心的将杀手这个角色完整演出。MV中导演安排了两位辣妹饰演杰伦的女朋友，除了有精彩的对手戏之外，更安排了一些「床戏」的部分，没有见过的杰伦，不一样的杰伦，在这首MV中都带给观众很不一样的感觉，一个全新的周杰伦。\n\n⊙歌曲介绍\n\n以父之名\n\n杰伦与新兴鬼才作家黄俊郎的首度合作即擦出不一样的火花，黄俊郎现为华人版图出版社的一员，大家口中的ㄚ郎，出版过「这本书」、「第二本书」两本脍炙人口的图文书籍，同时亦是华人版图中的首席平面设计师，在他多才多艺的经历下，造就了以父之名这首特别又特殊的歌。\n\n以父之名这首歌的曲风特殊好记，加上复古音乐钢琴等的特殊搭配，辅以意大利文与歌剧上的融合，曲调跳脱一般流行音乐风格，曲风上的特别更令人眼睛一亮。歌词内容以『天父、教父、父亲』三者为主轴，说明了教父的无奈、父亲的慈悲、天父的无私…等的救赎观念，说明一个人为了要到达上位者，就必须放弃一些该有的自由与观念，但往往在荣耀的背后得到得只有孤独的陪伴，过去纯真的日子已不复存在，也无法重来。\n\n懦夫\n\n重金属饶舌摇滚的音乐曲风，加上一段与小朋友的RAP合唱，更添特殊有趣，歌词中以反讽毒品为主要诉求，写出那些对药物依赖、服用毒品的人发出质疑与怒吼。\n\n晴天\n\nPanasonic广告歌曲，春夏秋冬的恋曲，2003最贴心的情歌，温暖的曲调，清新的歌词，杰伦唱来丝丝入扣，一起约定，等到放晴的那天，共同来谱一段纯纯的爱。\n\n三年二班\n\n以乒乓球的拍打声贯穿全曲，杰伦以其独特的创意结合，令人惊艳，歌词上以学生的角度唱出在心中许久的压抑态度。\n\n东风破\n\n仿古小调曲风，辅以二胡与琵琶的融入，复古的曲风，听来让人容易进入唐诗宋词的世界与遐想，方文山想藉由古诗词入歌的想法，让古诗词与现代流行音乐融合，打破现今新诗与歌词分家的模式，在方文山的特别经营下，歌词古今交替，更有时空交错的感觉，「东风破」就是代表着这首歌曲的新名词。\n\n你听得到\n\n「杰伦杯」歌词比赛，再度在公司内引发一阵旋风。情人之间最甜蜜的情歌，我们之间的秘密，只有彼此知道，互相依赖的爱，让人最舍不得离开。\n\n同一种调调\n\n百事可乐广告曲，曲调利用琵琶的音色来塑造出西洋古典的气氛，间奏加入阿根廷探戈音乐加以贯穿，是为新一代嘻哈的代表。节奏轻快舒服，说明两个人虽不相识，也能成为心灵相通，有共同嗜好与默契的朋友。\n\n她的睫毛\n\n爱情没有一定的规则，没有是非对错，瞬间的感觉最重要，没有人可以教导爱情的喜怒哀乐，都要靠自己去学习揣摩，她的睫毛透露出爱的讯号，让人出乎意料。\n\n爱情悬崖\n\n徐若瑄再度跨刀填词，杰伦与Vivian再度合作，Vivian式的填词方式，说明爱情就像悬崖，爱的越深跌的越深，总是让人控制不来，歌曲朗朗上口，更令人感动。\n\n梯田\n\n杰伦首创以原住民的合声、中国声乐、古典钢琴在音乐上相互结合，编写出新式慢板饶舌曲风，歌词以诙谐幽默方式表达，暗喻人对环境的破坏是残忍的，环境既遭破坏，昔日情景已不复存在。\n\n双刀\n\n延续前三张专辑的精神，中国风的风格、精神特色，经过「娘子」的爱情观、「双截棍」的武术观、「龙拳」所表达的民族精神，「双刀」表达的是华人在唐人街被白人压迫欺负，要反抗颠覆父执辈的卑微以及凡事以和为贵的态度跟处理方式，反抗环境、反抗不平等的对待，发出新一代华人的怒吼。",
            "author": "周杰伦"
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "kw_238210",
                "name": "以父之名",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "05:42",
                "meta": {
                  "songId": "238210",
                  "albumName": "叶惠美",
                  "albumId": "1293",
                  "singerIds": [],
                  "picUrl": "http://img3.kuwo.cn/star/albumcover/120/s3s94/93/211513640.jpg",
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "32.38Mb"
                    },
                    {
                      "type": "320k",
                      "size": "13.05Mb"
                    },
                    {
                      "type": "128k",
                      "size": "5.22Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "32.38Mb"
                    },
                    "320k": {
                      "size": "13.05Mb"
                    },
                    "128k": {
                      "size": "5.22Mb"
                    }
                  }
                }
              },
              {
                "id": "kw_79476",
                "name": "懦夫",
                "singer": "周杰伦",
                "source": "kw",
                "interval": "03:38",
                "meta": {
                  "songId": "79476",
                  "albumName": "叶惠美",
                  "albumId": "1293",
                  "singerIds": [],
                  "picUrl": "http://img2.kuwo.cn/star/albumcover/120/s3s94/93/211513640.jpg",
                  "qualitys": [
                    {
                      "type": "flac",
                      "size": "26.8Mb"
                    },
                    {
                      "type": "320k",
                      "size": "8.32Mb"
                    },
                    {
                      "type": "128k",
                      "size": "3.33Mb"
                    }
                  ],
                  "_qualitys": {
                    "flac": {
                      "size": "26.8Mb"
                    },
                    "320k": {
                      "size": "8.32Mb"
                    },
                    "128k": {
                      "size": "3.33Mb"
                    }
                  }
                }
              }
            ]
          },
          "total": 11,
          "page": 1,
          "limit": 10,
          "source": "kw"
        }
      },
      "singer": {
        "ok": false,
        "elapsedMs": 2,
        "error": "electronApplication.evaluate: Error: 此平台的歌手详情未提供受支持的公开接口\n    at C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:913:18\n    at detailCached (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:254:19)\n    at Object.getSinger (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:895:10)\n    at eval (eval at evaluate (:370:30), <anonymous>:1:54)\n    at UtilityScript.evaluate (<anonymous>:372:16)\n    at UtilityScript.<anonymous> (<anonymous>:1:44)"
      },
      "searchPaging": {
        "ok": true,
        "value": {
          "page1": [
            "kw_228908",
            "kw_118980",
            "kw_118987",
            "kw_324244",
            "kw_3195905"
          ],
          "page2": [
            "kw_94237",
            "kw_94239",
            "kw_440613",
            "kw_118990",
            "kw_440616"
          ]
        }
      }
    },
    "kg": {
      "search": {
        "ok": true,
        "elapsedMs": 332,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "kg_20505418",
                "name": "晴天",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "04:29",
                "meta": {
                  "songId": 20505418,
                  "albumName": "叶惠美",
                  "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7",
                  "albumAudioId": "32100650",
                  "albumId": "966846",
                  "singerIds": [
                    "3520"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20230920/20230920142503632013.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.12M",
                      "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
                    },
                    {
                      "type": "320k",
                      "size": "10.29M",
                      "hash": "1B56126A8A03924F1DD066259C095CBC"
                    },
                    {
                      "type": "flac",
                      "size": "30.17M",
                      "hash": "0A69169202DE95AAF24A9944CCF0730D"
                    },
                    {
                      "type": "flac24bit",
                      "size": "52.83M",
                      "hash": "D667BC5EE93F201126697CB3BA745009"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.12M",
                      "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
                    },
                    "320k": {
                      "size": "10.29M",
                      "hash": "1B56126A8A03924F1DD066259C095CBC"
                    },
                    "flac": {
                      "size": "30.17M",
                      "hash": "0A69169202DE95AAF24A9944CCF0730D"
                    },
                    "flac24bit": {
                      "size": "52.83M",
                      "hash": "D667BC5EE93F201126697CB3BA745009"
                    }
                  }
                }
              },
              {
                "id": "kg_339796",
                "name": "青花瓷",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "03:59",
                "meta": {
                  "songId": 339796,
                  "albumName": "我很忙",
                  "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A",
                  "albumAudioId": "32218352",
                  "albumId": "979856",
                  "singerIds": [
                    "3520"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20220705/20220705143006989099.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.65M",
                      "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A"
                    },
                    {
                      "type": "320k",
                      "size": "9.13M",
                      "hash": "D38BFF1043FEC27B8D40F40DA953CB0E"
                    },
                    {
                      "type": "flac",
                      "size": "24.96M",
                      "hash": "30A29CC648163DD4F265C6E7B4E07C57"
                    },
                    {
                      "type": "flac24bit",
                      "size": "25.61M",
                      "hash": "A86A3D8AFABE012A0095CB0EEBF55D50"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.65M",
                      "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A"
                    },
                    "320k": {
                      "size": "9.13M",
                      "hash": "D38BFF1043FEC27B8D40F40DA953CB0E"
                    },
                    "flac": {
                      "size": "24.96M",
                      "hash": "30A29CC648163DD4F265C6E7B4E07C57"
                    },
                    "flac24bit": {
                      "size": "25.61M",
                      "hash": "A86A3D8AFABE012A0095CB0EEBF55D50"
                    }
                  }
                }
              }
            ]
          },
          "total": 480,
          "page": 1,
          "limit": 5,
          "source": "kg"
        }
      },
      "playlists": {
        "ok": true,
        "elapsedMs": 291,
        "value": {
          "count": 30,
          "sample": [
            {
              "id": "3823475",
              "source": "kg",
              "name": "【风靡全网】2026年度精选热歌（全网热搜）",
              "cover": "https://imgessl.kugou.com/soft/collection/400/20210518/20210518180852210693.jpg",
              "author": "",
              "description": "每首歌都像星星，在星球上拥有自己的位置",
              "playCount": 660047269
            },
            {
              "id": "8268942",
              "source": "kg",
              "name": "2026伤感情歌大全：爱情，他不讲道理",
              "cover": "https://imgessl.kugou.com/soft/collection/400/20250116/20250116114138272323.jpg",
              "author": "",
              "description": "喜欢，本就没什么原因，爱情，也不讲什么道理。",
              "playCount": 138689675
            }
          ]
        }
      },
      "boards": {
        "ok": true,
        "elapsedMs": 316,
        "value": {
          "count": 55,
          "sample": [
            {
              "id": "8888",
              "name": "TOP500"
            },
            {
              "id": "85897",
              "name": "国潮音乐榜"
            }
          ]
        }
      },
      "hot": {
        "ok": true,
        "elapsedMs": 275,
        "value": {
          "count": 270,
          "sample": [
            "无奈的思绪",
            "天龙八部之宿敌"
          ]
        }
      },
      "lyrics": {
        "ok": true,
        "elapsedMs": 63,
        "value": {
          "lyric": {
            "characters": 1455,
            "sample": "[ti:晴天]\r\n[ar:周杰伦]\r\n[al:叶惠美]\r\n[by:]\r\n[offset:0]\r\n[00:00.00]晴天 - 周杰伦 (Jay Chou)\r\n[00:02.25]词：周杰伦\r\n[00:04.50]曲：周杰伦\r\n[00:06.75]编曲：周杰伦\r\n[00:09.00]制作人：周杰伦\r\n[00:11.25]合声：周杰伦\r\n[00:13.50]合声编写：周杰伦\r\n[00:15.75]吉他"
          }
        }
      },
      "comments": {
        "ok": false,
        "elapsedMs": 43,
        "error": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: net::ERR_CERT_COMMON_NAME_INVALID"
      },
      "page2": {
        "ok": true,
        "elapsedMs": 70,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "kg_316558",
                "name": "枫",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "04:35",
                "meta": {
                  "songId": 316558,
                  "albumName": "十一月的萧邦",
                  "hash": "0D7E8C11C961A17EB8779FEB0CA772E3",
                  "albumAudioId": "32029516",
                  "albumId": "958909",
                  "singerIds": [
                    "3520"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20250125/20250125121901851911.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.21M",
                      "hash": "0D7E8C11C961A17EB8779FEB0CA772E3"
                    },
                    {
                      "type": "320k",
                      "size": "10.52M",
                      "hash": "858B34B2BE2E2B0FDA83E1E3A2F1813B"
                    },
                    {
                      "type": "flac",
                      "size": "29.18M",
                      "hash": "F5C3EAC58187030AB476A47196E6897A"
                    },
                    {
                      "type": "flac24bit",
                      "size": "114.31M",
                      "hash": "81F7C70059AD46B2BAFE6392D5120D05"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.21M",
                      "hash": "0D7E8C11C961A17EB8779FEB0CA772E3"
                    },
                    "320k": {
                      "size": "10.52M",
                      "hash": "858B34B2BE2E2B0FDA83E1E3A2F1813B"
                    },
                    "flac": {
                      "size": "29.18M",
                      "hash": "F5C3EAC58187030AB476A47196E6897A"
                    },
                    "flac24bit": {
                      "size": "114.31M",
                      "hash": "81F7C70059AD46B2BAFE6392D5120D05"
                    }
                  }
                }
              },
              {
                "id": "kg_332453",
                "name": "稻香",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "03:43",
                "meta": {
                  "songId": 332453,
                  "albumName": "魔杰座",
                  "hash": "8909E1809908CD8E3BF6CF85D98B93F0",
                  "albumAudioId": "32042828",
                  "albumId": "960399",
                  "singerIds": [
                    "3520"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20241118/20241118160622508429.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.41M",
                      "hash": "8909E1809908CD8E3BF6CF85D98B93F0"
                    },
                    {
                      "type": "320k",
                      "size": "8.53M",
                      "hash": "21AC928E1D68EC3632EF2CAE68718201"
                    },
                    {
                      "type": "flac",
                      "size": "24.81M",
                      "hash": "36AB2C542AF54578EFD376A4E2C57C1F"
                    },
                    {
                      "type": "flac24bit",
                      "size": "84.60M",
                      "hash": "D987462A7FD98151845DB245FE214267"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.41M",
                      "hash": "8909E1809908CD8E3BF6CF85D98B93F0"
                    },
                    "320k": {
                      "size": "8.53M",
                      "hash": "21AC928E1D68EC3632EF2CAE68718201"
                    },
                    "flac": {
                      "size": "24.81M",
                      "hash": "36AB2C542AF54578EFD376A4E2C57C1F"
                    },
                    "flac24bit": {
                      "size": "84.60M",
                      "hash": "D987462A7FD98151845DB245FE214267"
                    }
                  }
                }
              }
            ]
          },
          "total": 480,
          "page": 2,
          "limit": 5,
          "source": "kg"
        }
      },
      "playlistDetail": {
        "ok": true,
        "elapsedMs": 2398,
        "value": {
          "info": {
            "id": "3823475",
            "source": "kg",
            "name": "【风靡全网】2026年度精选热歌（全网热搜）",
            "cover": "",
            "author": "",
            "description": "酷狗音乐歌单《【风靡全网】2026年度精选热歌（全网热搜）》，简介：每首歌都像星星，在星球上拥有自己的位置，更多歌单，尽在酷狗音乐。",
            "playCount": 0
          },
          "tracks": {
            "count": 801,
            "sample": [
              {
                "id": "kg_1108210450",
                "name": "远不止你我",
                "singer": "刘宇",
                "source": "kg",
                "interval": "03:40",
                "meta": {
                  "songId": 1108210450,
                  "albumName": "",
                  "hash": "C68D2F78EC7115BB57BBC1773FB60914",
                  "albumAudioId": 957280245,
                  "albumId": "205989993",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20260907/20260907120141321197.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.36M",
                      "hash": "C68D2F78EC7115BB57BBC1773FB60914"
                    },
                    {
                      "type": "320k",
                      "size": "8.40M",
                      "hash": "E3D0CE62BE7D5D7F134A55CCBCEE9533"
                    },
                    {
                      "type": "flac",
                      "size": "23.34M",
                      "hash": "3AEF2EA35560C84D7DC9B7B231F5F924"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.36M",
                      "hash": "C68D2F78EC7115BB57BBC1773FB60914"
                    },
                    "320k": {
                      "size": "8.40M",
                      "hash": "E3D0CE62BE7D5D7F134A55CCBCEE9533"
                    },
                    "flac": {
                      "size": "23.34M",
                      "hash": "3AEF2EA35560C84D7DC9B7B231F5F924"
                    }
                  }
                }
              },
              {
                "id": "kg_576353068",
                "name": "洛神",
                "singer": "乱徵",
                "source": "kg",
                "interval": "04:37",
                "meta": {
                  "songId": 576353068,
                  "albumName": "",
                  "hash": "C7F29D050D8C8161FD26E27BC494FD8A",
                  "albumAudioId": 883932166,
                  "albumId": "206138430",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20260903/20260903154641376658.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.24M",
                      "hash": "C7F29D050D8C8161FD26E27BC494FD8A"
                    },
                    {
                      "type": "320k",
                      "size": "10.59M",
                      "hash": "32BBE6662FE46C60D1E5092B3E83255B"
                    },
                    {
                      "type": "flac",
                      "size": "30.98M",
                      "hash": "4E5E524579CB05D8F58A6EC57F4ED4FA"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.24M",
                      "hash": "C7F29D050D8C8161FD26E27BC494FD8A"
                    },
                    "320k": {
                      "size": "10.59M",
                      "hash": "32BBE6662FE46C60D1E5092B3E83255B"
                    },
                    "flac": {
                      "size": "30.98M",
                      "hash": "4E5E524579CB05D8F58A6EC57F4ED4FA"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      "boardTracks": {
        "ok": true,
        "elapsedMs": 58,
        "value": {
          "list": {
            "count": 30,
            "sample": [
              {
                "id": "kg_284977",
                "name": "我不难过",
                "singer": "孙燕姿",
                "source": "kg",
                "interval": "05:20",
                "meta": {
                  "songId": 284977,
                  "albumName": "",
                  "hash": "3FD7E1EC51122C745C637735C8BDE716",
                  "albumAudioId": 32092078,
                  "albumId": "965883",
                  "singerIds": [
                    "5826"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20250624/20250624174203375937.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.89M",
                      "hash": "3FD7E1EC51122C745C637735C8BDE716"
                    },
                    {
                      "type": "320k",
                      "size": "12.23M",
                      "hash": "C4F5F3EAB5EDDA7E150A02BBE9D4D2E3"
                    },
                    {
                      "type": "flac",
                      "size": "34.14M",
                      "hash": "40652F6D57A19CC77E9E2416A5A4F8EE"
                    },
                    {
                      "type": "flac24bit",
                      "size": "34.82M",
                      "hash": "BBB4612A8CDADC66379213532AD01EAB"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.89M",
                      "hash": "3FD7E1EC51122C745C637735C8BDE716"
                    },
                    "320k": {
                      "size": "12.23M",
                      "hash": "C4F5F3EAB5EDDA7E150A02BBE9D4D2E3"
                    },
                    "flac": {
                      "size": "34.14M",
                      "hash": "40652F6D57A19CC77E9E2416A5A4F8EE"
                    },
                    "flac24bit": {
                      "size": "34.82M",
                      "hash": "BBB4612A8CDADC66379213532AD01EAB"
                    }
                  }
                }
              },
              {
                "id": "kg_653605791",
                "name": "自由的你",
                "singer": "G.E.M.邓紫棋",
                "source": "kg",
                "interval": "04:56",
                "meta": {
                  "songId": 653605791,
                  "albumName": "",
                  "hash": "98CA3FB8B73C0E4C35312A88D3F348E5",
                  "albumAudioId": 963769012,
                  "albumId": "207873836",
                  "singerIds": [
                    "4490"
                  ],
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20261005/20261005235942500971.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.53M",
                      "hash": "98CA3FB8B73C0E4C35312A88D3F348E5"
                    },
                    {
                      "type": "320k",
                      "size": "11.33M",
                      "hash": "374FE95C6EDCFA58DB928319C896E7B6"
                    },
                    {
                      "type": "flac",
                      "size": "35.33M",
                      "hash": "D2C0F70AAB8EF69EE171E3B52C6CEFCA"
                    },
                    {
                      "type": "flac24bit",
                      "size": "64.58M",
                      "hash": "DFA0439DD585B17CF4BE246C3A136403"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.53M",
                      "hash": "98CA3FB8B73C0E4C35312A88D3F348E5"
                    },
                    "320k": {
                      "size": "11.33M",
                      "hash": "374FE95C6EDCFA58DB928319C896E7B6"
                    },
                    "flac": {
                      "size": "35.33M",
                      "hash": "D2C0F70AAB8EF69EE171E3B52C6CEFCA"
                    },
                    "flac24bit": {
                      "size": "64.58M",
                      "hash": "DFA0439DD585B17CF4BE246C3A136403"
                    }
                  }
                }
              }
            ]
          },
          "total": 500,
          "page": 1,
          "limit": 30,
          "source": "kg"
        }
      },
      "playlistSearch": {
        "ok": true,
        "elapsedMs": 342,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "6409645",
                "source": "kg",
                "name": "周杰伦必听热歌｜聆听周式金曲，聆听青春记忆",
                "cover": "https://imgessl.kugou.com/soft/collection/400/20260414/20260414170554928435.png",
                "author": "酷乐推荐",
                "description": "",
                "playCount": 35783080
              },
              {
                "id": "9404077",
                "source": "kg",
                "name": "演唱会曲目 | 周杰伦 《嘉年华Ⅱ》巡演",
                "cover": "https://imgessl.kugou.com/soft/collection/400/20260512/20260512192237772493.jpg",
                "author": "酷狗站-现场看我的",
                "description": "",
                "playCount": 577073
              }
            ]
          },
          "total": 480,
          "page": 1,
          "limit": 5,
          "source": "kg"
        }
      },
      "tags": {
        "ok": false,
        "elapsedMs": 1,
        "error": "electronApplication.evaluate: Error: 酷狗此公开歌单接口暂不支持标签筛选\n    at C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:830:11\n    at detailCached (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:254:19)\n    at Object.getPlaylistTags (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:807:10)\n    at eval (eval at evaluate (:370:30), <anonymous>:1:51)\n    at UtilityScript.evaluate (<anonymous>:372:16)\n    at UtilityScript.<anonymous> (<anonymous>:1:44)"
      },
      "playlistsPage2": {
        "ok": true,
        "elapsedMs": 352,
        "value": {
          "count": 30,
          "sample": [
            {
              "id": "3845296",
              "source": "kg",
              "name": "每个不曾奔跑的日子，都是对生命的辜负",
              "cover": "https://imgessl.kugou.com/custom/400/20210527/20210527131611725688.jpg",
              "author": "",
              "description": "每天一小时的奔跑对一个跑者而言，就像是生命的馈赠。在这一小时，他可以抛却所有烦恼，完成沉浸在自己的世界里。\n倾听自己的心跳和风的呼啸，倾听美妙的乐章，感受着时间的流逝，感受着鸟语花香。只有跑起来，才会感受到这个世界的美好。\n这一小时的放空时间，足以坚定自己的内心，足以面对生活带来的各种挑战，我想大概只有跑步的人，更能体会这样的感悟吧。",
              "playCount": 3883550
            },
            {
              "id": "4131938",
              "source": "kg",
              "name": "轻音：琵琶一曲肠堪断，风萧萧细夜漫漫",
              "cover": "https://imgessl.kugou.com/custom/400/20210822/20210822155412529411.jpg",
              "author": "",
              "description": "轻音：琵琶一曲肠堪断，风萧萧细夜漫漫",
              "playCount": 158598
            }
          ]
        }
      },
      "playlistPaging": {
        "ok": true,
        "value": {
          "page1": [
            "3823475",
            "8268942",
            "8582627"
          ],
          "page2": [
            "3845296",
            "4131938",
            "2667864"
          ]
        }
      },
      "suggestions": {
        "ok": true,
        "elapsedMs": 28,
        "value": {
          "count": 5,
          "sample": [
            "晴天",
            "青花瓷"
          ]
        }
      },
      "details": {
        "ok": true,
        "elapsedMs": 2,
        "value": {
          "id": "kg_20505418",
          "name": "晴天",
          "singer": "周杰伦",
          "source": "kg",
          "interval": "04:29",
          "meta": {
            "songId": 20505418,
            "albumName": "叶惠美",
            "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7",
            "albumAudioId": "32100650",
            "albumId": "966846",
            "singerIds": [
              "3520"
            ],
            "picUrl": "https://imgessl.kugou.com/stdmusic/400/20230920/20230920142503632013.jpg",
            "qualitys": [
              {
                "type": "128k",
                "size": "4.12M",
                "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
              },
              {
                "type": "320k",
                "size": "10.29M",
                "hash": "1B56126A8A03924F1DD066259C095CBC"
              },
              {
                "type": "flac",
                "size": "30.17M",
                "hash": "0A69169202DE95AAF24A9944CCF0730D"
              },
              {
                "type": "flac24bit",
                "size": "52.83M",
                "hash": "D667BC5EE93F201126697CB3BA745009"
              }
            ],
            "_qualitys": {
              "128k": {
                "size": "4.12M",
                "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
              },
              "320k": {
                "size": "10.29M",
                "hash": "1B56126A8A03924F1DD066259C095CBC"
              },
              "flac": {
                "size": "30.17M",
                "hash": "0A69169202DE95AAF24A9944CCF0730D"
              },
              "flac24bit": {
                "size": "52.83M",
                "hash": "D667BC5EE93F201126697CB3BA745009"
              }
            }
          }
        }
      },
      "album": {
        "ok": true,
        "elapsedMs": 57,
        "value": {
          "info": {
            "id": "966846",
            "name": "",
            "cover": "",
            "description": "",
            "author": ""
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "kg_317031",
                "name": "以父之名",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "05:42",
                "meta": {
                  "songId": 317031,
                  "albumName": "",
                  "hash": "DBC0207490EB51153EF933EF5A7E98E4",
                  "albumAudioId": 32100648,
                  "albumId": "966846",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20230920/20230920142503632013.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "5.22M",
                      "hash": "DBC0207490EB51153EF933EF5A7E98E4"
                    },
                    {
                      "type": "320k",
                      "size": "13.05M",
                      "hash": "6CD9FE00C6FA07186BA0100A6310D772"
                    },
                    {
                      "type": "flac",
                      "size": "32.38M",
                      "hash": "B699609601766CEE683630E408A5F18D"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "5.22M",
                      "hash": "DBC0207490EB51153EF933EF5A7E98E4"
                    },
                    "320k": {
                      "size": "13.05M",
                      "hash": "6CD9FE00C6FA07186BA0100A6310D772"
                    },
                    "flac": {
                      "size": "32.38M",
                      "hash": "B699609601766CEE683630E408A5F18D"
                    }
                  }
                }
              },
              {
                "id": "kg_351479",
                "name": "懦夫",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "03:38",
                "meta": {
                  "songId": 351479,
                  "albumName": "",
                  "hash": "DB9A93EAAF26738E7E76043B29E6FBB7",
                  "albumAudioId": 32100649,
                  "albumId": "966846",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20230920/20230920142503632013.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.33M",
                      "hash": "DB9A93EAAF26738E7E76043B29E6FBB7"
                    },
                    {
                      "type": "320k",
                      "size": "8.32M",
                      "hash": "F83C54D339066EAA7D764EF52D75F748"
                    },
                    {
                      "type": "flac",
                      "size": "26.80M",
                      "hash": "EEB0AD5189F31B7794BAB587717221CA"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.33M",
                      "hash": "DB9A93EAAF26738E7E76043B29E6FBB7"
                    },
                    "320k": {
                      "size": "8.32M",
                      "hash": "F83C54D339066EAA7D764EF52D75F748"
                    },
                    "flac": {
                      "size": "26.80M",
                      "hash": "EEB0AD5189F31B7794BAB587717221CA"
                    }
                  }
                }
              }
            ]
          },
          "total": 11,
          "page": 1,
          "limit": 10,
          "source": "kg"
        }
      },
      "singer": {
        "ok": true,
        "elapsedMs": 40,
        "value": {
          "info": {
            "id": "3520",
            "name": "周杰伦",
            "cover": "http://singerimg.kugou.com/uploadpic/softhead/400/20260324/20260324203006202058.jpg",
            "description": "周杰伦，英文名字JayChou，七九年出生的他早在念淡江中学音乐科时上“超级新人王”，就被主持人吴宗宪相中而签约。十八岁那年就交出不少亮眼的作品，包括吴宗宪的《屋顶》、王力宏的《打开爱》等。 周杰伦一出场给人一种爱耍酷的感觉，不喜与媒体亲近。然而作曲、填词、编曲、主唱，样样俱精的他，首张唱碟便给人一种横空出世的感觉，绝对惊喜。随后即得到“音乐新人王”称号，而且周杰伦具有自成一格的R&B演绎方法，桀骜不驯、酷酷的演唱风格，虽然被很多人认为“吐字不清”，但丝毫不影响他的身价一路狂飙，直升到天王级。",
            "author": ""
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "kg_20505418",
                "name": "晴天",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "04:29",
                "meta": {
                  "songId": 20505418,
                  "albumName": "叶惠美",
                  "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7",
                  "albumAudioId": 32100650,
                  "albumId": "966846",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20230920/20230920142503632013.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.12M",
                      "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
                    },
                    {
                      "type": "320k",
                      "size": "10.29M",
                      "hash": "1B56126A8A03924F1DD066259C095CBC"
                    },
                    {
                      "type": "flac",
                      "size": "30.17M",
                      "hash": "0A69169202DE95AAF24A9944CCF0730D"
                    },
                    {
                      "type": "flac24bit",
                      "size": "52.83M",
                      "hash": "D667BC5EE93F201126697CB3BA745009"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.12M",
                      "hash": "B3A52A7A958BF0AED0EBFBA2E9A818B7"
                    },
                    "320k": {
                      "size": "10.29M",
                      "hash": "1B56126A8A03924F1DD066259C095CBC"
                    },
                    "flac": {
                      "size": "30.17M",
                      "hash": "0A69169202DE95AAF24A9944CCF0730D"
                    },
                    "flac24bit": {
                      "size": "52.83M",
                      "hash": "D667BC5EE93F201126697CB3BA745009"
                    }
                  }
                }
              },
              {
                "id": "kg_339796",
                "name": "青花瓷",
                "singer": "周杰伦",
                "source": "kg",
                "interval": "03:59",
                "meta": {
                  "songId": 339796,
                  "albumName": "我很忙",
                  "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A",
                  "albumAudioId": 32218352,
                  "albumId": "979856",
                  "picUrl": "https://imgessl.kugou.com/stdmusic/400/20220705/20220705143006989099.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.65M",
                      "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A"
                    },
                    {
                      "type": "320k",
                      "size": "9.13M",
                      "hash": "D38BFF1043FEC27B8D40F40DA953CB0E"
                    },
                    {
                      "type": "flac",
                      "size": "24.96M",
                      "hash": "30A29CC648163DD4F265C6E7B4E07C57"
                    },
                    {
                      "type": "flac24bit",
                      "size": "25.61M",
                      "hash": "A86A3D8AFABE012A0095CB0EEBF55D50"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.65M",
                      "hash": "37A8F50A9EC3B267C3CC6BEC633D9C4A"
                    },
                    "320k": {
                      "size": "9.13M",
                      "hash": "D38BFF1043FEC27B8D40F40DA953CB0E"
                    },
                    "flac": {
                      "size": "24.96M",
                      "hash": "30A29CC648163DD4F265C6E7B4E07C57"
                    },
                    "flac24bit": {
                      "size": "25.61M",
                      "hash": "A86A3D8AFABE012A0095CB0EEBF55D50"
                    }
                  }
                }
              }
            ]
          },
          "total": 1845,
          "page": 1,
          "limit": 10,
          "source": "kg"
        }
      },
      "searchPaging": {
        "ok": true,
        "value": {
          "page1": [
            "kg_20505418",
            "kg_339796",
            "kg_339589",
            "kg_254112",
            "kg_338638"
          ],
          "page2": [
            "kg_316558",
            "kg_332453",
            "kg_832771",
            "kg_2561552",
            "kg_298888513"
          ]
        }
      }
    },
    "tx": {
      "search": {
        "ok": true,
        "elapsedMs": 415,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "tx_001Bbywq2gicae",
                "name": "搁浅",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:00",
                "meta": {
                  "songId": "001Bbywq2gicae",
                  "albumName": "七里香",
                  "id": 102065750,
                  "strMediaMid": "004UlK9x0jeuow",
                  "albumId": "003DFRzD192KKD",
                  "albumMid": "003DFRzD192KKD",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.67M"
                    },
                    {
                      "type": "320k",
                      "size": "9.16M"
                    },
                    {
                      "type": "flac",
                      "size": "24.96M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.67M"
                    },
                    "320k": {
                      "size": "9.16M"
                    },
                    "flac": {
                      "size": "24.96M"
                    }
                  }
                }
              },
              {
                "id": "tx_0039MnYb0qxYhV",
                "name": "晴天",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:29",
                "meta": {
                  "songId": "0039MnYb0qxYhV",
                  "albumName": "叶惠美",
                  "id": 97773,
                  "strMediaMid": "003Qui1q2u1Zho",
                  "albumId": "000MkMni19ClKG",
                  "albumMid": "000MkMni19ClKG",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000000MkMni19ClKG.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.12M"
                    },
                    {
                      "type": "320k",
                      "size": "10.29M"
                    },
                    {
                      "type": "flac",
                      "size": "52.83M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.12M"
                    },
                    "320k": {
                      "size": "10.29M"
                    },
                    "flac": {
                      "size": "52.83M"
                    }
                  }
                }
              }
            ]
          },
          "total": 999,
          "page": 1,
          "limit": 5,
          "source": "tx"
        }
      },
      "playlists": {
        "ok": true,
        "elapsedMs": 393,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "7707261125",
              "source": "tx",
              "name": "甜度爆表 | 旋律说唱狙击少女心",
              "cover": "http://qpic.y.qq.com/music_cover/s4SoBc0IrDEDpHKlDkDflKbCgbic5ldSQrdsEafqvxULdib5CvKhaibww/300?n=1",
              "author": "我想要两颗西柚",
              "description": "",
              "playCount": 8553517
            },
            {
              "id": "7578943835",
              "source": "tx",
              "name": "丧系Rap丨渐渐不再期待任何东西",
              "cover": "http://qpic.y.qq.com/music_cover/1Jcpjia5qaEibPyTuy709wFiapqHbxdewwwc5yBJI7NiaNMN9XDhUJPibJA/300?n=1",
              "author": "离妄.",
              "description": "",
              "playCount": 1814521
            }
          ]
        }
      },
      "boards": {
        "ok": true,
        "elapsedMs": 255,
        "value": {
          "count": 25,
          "sample": [
            {
              "id": "4",
              "name": "巅峰榜·流行指数"
            },
            {
              "id": "26",
              "name": "巅峰榜·热歌"
            }
          ]
        }
      },
      "hot": {
        "ok": true,
        "elapsedMs": 259,
        "value": {
          "count": 30,
          "sample": [
            "茶汤 郁可唯",
            "金玉良缘"
          ]
        }
      },
      "lyrics": {
        "ok": true,
        "elapsedMs": 57,
        "value": {
          "lyric": {
            "characters": 915,
            "sample": "[ti:搁浅]\n[ar:周杰伦]\n[al:七里香]\n[by:]\n[offset:0]\n[00:00.00]搁浅 - 周杰伦 (Jay Chou)\n[00:04.08]词：宋健彰\n[00:08.17]曲：周杰伦\n[00:12.25]编曲：钟兴民\n[00:16.34]久未放晴的天空\n[00:20.13]依旧留着你的笑容\n[00:24.25]哭过却无法掩埋歉疚\n[00:31.92]风筝在阴天搁浅\n[00"
          },
          "tlyric": null
        }
      },
      "comments": {
        "ok": true,
        "elapsedMs": 136,
        "value": {
          "count": 20,
          "sample": [
            {
              "id": "1!5MNAQn9Mtbxbsg9qQZ1CIgrbEQ5sw9KYH9DmomYiW1Sm2o2cRqSg7-IaU8vQL2rS",
              "author": "厌",
              "avatar": "https://pic6.y.qq.com/qqmusic/avatar/37696f416f4b43736f4b7635-1739891655/140",
              "text": "过于在意的东西，永远都在折磨你",
              "time": "2026/10/13 05:02:17",
              "likes": 0
            },
            {
              "id": "1!Ag0vqapIL16phP8P6.xIqnMBJtBLVsoK0G8UX6MpoETXm8o8AZFk-3I0HYKg3ipT",
              "author": "豪宅豪车神颜专权ss",
              "avatar": "https://pic6.y.qq.com/qqmusic/avatar/6f4b366b6f7745416f4b347a3765435037656e6b4e656f414e6e2a2a-1740691008/140",
              "text": "隐瞒了我一开始都知道再晚几年成仇家了",
              "time": "2026/10/13 04:34:08",
              "likes": 0
            }
          ]
        }
      },
      "page2": {
        "ok": true,
        "elapsedMs": 180,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "tx_003aAYrm3GE0Ac",
                "name": "稻香",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "03:43",
                "meta": {
                  "songId": "003aAYrm3GE0Ac",
                  "albumName": "魔杰座",
                  "id": 449205,
                  "strMediaMid": "0020wJDo3cx0j3",
                  "albumId": "002Neh8l0uciQZ",
                  "albumMid": "002Neh8l0uciQZ",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000002Neh8l0uciQZ.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.41M"
                    },
                    {
                      "type": "320k",
                      "size": "8.53M"
                    },
                    {
                      "type": "flac",
                      "size": "24.81M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.41M"
                    },
                    "320k": {
                      "size": "8.53M"
                    },
                    "flac": {
                      "size": "24.81M"
                    }
                  }
                }
              },
              {
                "id": "tx_003xv4w313tZHV",
                "name": "红尘客栈",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:34",
                "meta": {
                  "songId": "003xv4w313tZHV",
                  "albumName": "十二新作",
                  "id": 5177680,
                  "strMediaMid": "000d5VXa1mFK4G",
                  "albumId": "003Ow85E3pnoqi",
                  "albumMid": "003Ow85E3pnoqi",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003Ow85E3pnoqi.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.18M"
                    },
                    {
                      "type": "320k",
                      "size": "10.46M"
                    },
                    {
                      "type": "flac",
                      "size": "27.20M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.18M"
                    },
                    "320k": {
                      "size": "10.46M"
                    },
                    "flac": {
                      "size": "27.20M"
                    }
                  }
                }
              }
            ]
          },
          "total": 999,
          "page": 2,
          "limit": 5,
          "source": "tx"
        }
      },
      "playlistDetail": {
        "ok": true,
        "elapsedMs": 159,
        "value": {
          "info": {
            "id": "7707261125",
            "source": "tx",
            "name": "甜度爆表 | 旋律说唱狙击少女心",
            "cover": "https://qpic.y.qq.com/music_cover/s4SoBc0IrDEDpHKlDkDflKbCgbic5ldSQrdsEafqvxULdib5CvKhaibww/600",
            "author": "我想要两颗西柚",
            "description": "不怕rapper有文化，就怕rapper说情话。甜系说唱真的太可啦！",
            "playCount": 0
          },
          "tracks": {
            "count": 66,
            "sample": [
              {
                "id": "tx_002xTzGb2UBQRk",
                "name": "你的",
                "singer": "DouDou、Viva宋佩豫",
                "source": "tx",
                "interval": "02:43",
                "meta": {
                  "songId": "002xTzGb2UBQRk",
                  "albumName": "你的",
                  "id": 127404639,
                  "strMediaMid": "002AkhKv0YDLIl",
                  "albumId": "0023VbHy1oT80v",
                  "albumMid": "0023VbHy1oT80v",
                  "singerIds": [
                    "003xfLpu4CFSUP",
                    "004UQ7zJ09eOoj"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M0000023VbHy1oT80v.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.50M"
                    },
                    {
                      "type": "320k",
                      "size": "6.24M"
                    },
                    {
                      "type": "flac",
                      "size": "18.48M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.50M"
                    },
                    "320k": {
                      "size": "6.24M"
                    },
                    "flac": {
                      "size": "18.48M"
                    }
                  }
                }
              },
              {
                "id": "tx_001PfID21QGDh3",
                "name": "Dawn of us",
                "singer": "王嘉尔",
                "source": "tx",
                "interval": "02:59",
                "meta": {
                  "songId": "001PfID21QGDh3",
                  "albumName": "Dawn of us",
                  "id": 213730498,
                  "strMediaMid": "002IXrqw3nREZ1",
                  "albumId": "0014u7SS0oiI3h",
                  "albumMid": "0014u7SS0oiI3h",
                  "singerIds": [
                    "00216fJA496xQG"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M0000014u7SS0oiI3h.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.75M"
                    },
                    {
                      "type": "320k",
                      "size": "6.86M"
                    },
                    {
                      "type": "flac",
                      "size": "20.27M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.75M"
                    },
                    "320k": {
                      "size": "6.86M"
                    },
                    "flac": {
                      "size": "20.27M"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      "boardTracks": {
        "ok": true,
        "elapsedMs": 116,
        "value": {
          "list": {
            "count": 100,
            "sample": [
              {
                "id": "tx_002qUdaX4ba2ez",
                "name": "自由的你",
                "singer": "G.E.M.邓紫棋",
                "source": "tx",
                "interval": "04:56",
                "meta": {
                  "songId": "002qUdaX4ba2ez",
                  "albumName": "自由的你",
                  "id": 726476108,
                  "strMediaMid": "003qIE5u4Vk00t",
                  "albumId": "002Cy8kL400ft2",
                  "albumMid": "002Cy8kL400ft2",
                  "singerIds": [
                    "001fNHEf1SFEFN"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000002Cy8kL400ft2.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.53M"
                    },
                    {
                      "type": "320k",
                      "size": "11.33M"
                    },
                    {
                      "type": "flac",
                      "size": "64.58M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.53M"
                    },
                    "320k": {
                      "size": "11.33M"
                    },
                    "flac": {
                      "size": "64.58M"
                    }
                  }
                }
              },
              {
                "id": "tx_004OJ2Hr0NDxI7",
                "name": "傻鱼",
                "singer": "王栎鑫",
                "source": "tx",
                "interval": "04:24",
                "meta": {
                  "songId": "004OJ2Hr0NDxI7",
                  "albumName": "傻鱼",
                  "id": 715153678,
                  "strMediaMid": "004OJ2Hr0NDxI7",
                  "albumId": "000DhB7t19gQYc",
                  "albumMid": "000DhB7t19gQYc",
                  "singerIds": [
                    "000TprbQ0R4aGb"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000000DhB7t19gQYc.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.04M"
                    },
                    {
                      "type": "320k",
                      "size": "10.11M"
                    },
                    {
                      "type": "flac",
                      "size": "48.94M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.04M"
                    },
                    "320k": {
                      "size": "10.11M"
                    },
                    "flac": {
                      "size": "48.94M"
                    }
                  }
                }
              }
            ]
          },
          "total": 100,
          "page": 1,
          "limit": 100,
          "source": "tx"
        }
      },
      "playlistSearch": {
        "ok": true,
        "elapsedMs": 332,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "3805603854",
                "source": "tx",
                "name": "周杰伦歌曲大全！一张歌单全听完",
                "cover": "http://p.qpic.cn/music_cover/gaSSCRswoq7NlpHA8vK1PlQBJ2PTPia46icDP0S5LXEvDwJF2lgPh6fQ/600",
                "author": "歌单狂魔",
                "description": "“周杰伦”三个字是不变的信仰！\n歌单收集杰伦最全歌曲合集，所有关于杰伦的都值�...",
                "playCount": 908316856
              },
              {
                "id": "3235982757",
                "source": "tx",
                "name": "一个00年代的记忆—周杰伦",
                "cover": "http://p.qpic.cn/music_cover/Ae03ichy4MAUwVvicZ0QcqkSDiaJDxG6mYqKyO8pJp09lbtemwcOjo8FA/600",
                "author": "南巷旧事",
                "description": "多少人的记忆——周杰伦！2000年周杰伦出现了，在杨峻荣的推荐下，周杰伦开始演唱�...",
                "playCount": 125853023
              }
            ]
          },
          "total": 46877,
          "page": 1,
          "limit": 5,
          "source": "tx"
        }
      },
      "tags": {
        "ok": true,
        "elapsedMs": 52,
        "value": {
          "count": 65,
          "sample": [
            {
              "id": "10000000",
              "name": "全部",
              "group": "热门"
            },
            {
              "id": "165",
              "name": "国语",
              "group": "语种"
            }
          ]
        }
      },
      "taggedPlaylists": {
        "ok": true,
        "elapsedMs": 130,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "7707261125",
              "source": "tx",
              "name": "甜度爆表 | 旋律说唱狙击少女心",
              "cover": "http://qpic.y.qq.com/music_cover/s4SoBc0IrDEDpHKlDkDflKbCgbic5ldSQrdsEafqvxULdib5CvKhaibww/300?n=1",
              "author": "我想要两颗西柚",
              "description": "",
              "playCount": 8553517
            },
            {
              "id": "7578943835",
              "source": "tx",
              "name": "丧系Rap丨渐渐不再期待任何东西",
              "cover": "http://qpic.y.qq.com/music_cover/1Jcpjia5qaEibPyTuy709wFiapqHbxdewwwc5yBJI7NiaNMN9XDhUJPibJA/300?n=1",
              "author": "离妄.",
              "description": "",
              "playCount": 1814521
            }
          ]
        }
      },
      "playlistsPage2": {
        "ok": true,
        "elapsedMs": 145,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "7738136801",
              "source": "tx",
              "name": "恋爱必听！甜到齁的rap情歌",
              "cover": "http://p.qpic.cn/music_cover/4sLx94ibHnz1nDfLQHYM6IKpic6xG9CYpaT96icsoOekF0thDzE9Y2F3A/600?n=1",
              "author": "PINK-",
              "description": "",
              "playCount": 5032144
            },
            {
              "id": "7657295368",
              "source": "tx",
              "name": "【咚鼓热歌】柔情似水，痴情如火",
              "cover": "http://qpic.y.qq.com/music_cover/bJKTW68rucuwkicG3kDH8hoe44vGAWbXTJtnA5P9mOPibSqyk5icDxOXQ/300?n=1",
              "author": "艾司唑仑",
              "description": "",
              "playCount": 23716550
            }
          ]
        }
      },
      "playlistPaging": {
        "ok": true,
        "value": {
          "page1": [
            "7707261125",
            "7578943835",
            "7729596131"
          ],
          "page2": [
            "7738136801",
            "7657295368",
            "7942692926"
          ]
        }
      },
      "newPlaylists": {
        "ok": true,
        "elapsedMs": 150,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "7107159327",
              "source": "tx",
              "name": "小猪佩奇睡前晚安曲",
              "cover": "http://p.qpic.cn/music_cover/xFPOwViasjDrpIibGzHvkZKpCsAx60npxgY9Xz3dyEc1MCuUP5NJmbtg/600?n=1",
              "author": "QQ音乐儿童",
              "description": "",
              "playCount": 2967592
            },
            {
              "id": "7091034030",
              "source": "tx",
              "name": "电子派对，释放压力自由舞动",
              "cover": "http://qpic.y.qq.com/music_cover/8eiaDBJ27yYicpMibYZmmEdNJ02LicspFpVR6XKr9t9RoGatJFN48zdfkA/300?n=1",
              "author": "小众又怎样",
              "description": "",
              "playCount": 518694
            }
          ]
        }
      },
      "suggestions": {
        "ok": true,
        "elapsedMs": 72,
        "value": {
          "count": 4,
          "sample": [
            "稻香",
            "枫"
          ]
        }
      },
      "details": {
        "ok": true,
        "elapsedMs": 147,
        "value": {
          "id": "tx_001Bbywq2gicae",
          "name": "搁浅",
          "singer": "周杰伦",
          "source": "tx",
          "interval": "04:00",
          "meta": {
            "songId": "001Bbywq2gicae",
            "albumName": "七里香",
            "id": 102065750,
            "strMediaMid": "004UlK9x0jeuow",
            "albumId": "003DFRzD192KKD",
            "albumMid": "003DFRzD192KKD",
            "singerIds": [
              "0025NhlN2yWrP4"
            ],
            "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
            "qualitys": [
              {
                "type": "128k",
                "size": "3.67M"
              },
              {
                "type": "320k",
                "size": "9.16M"
              },
              {
                "type": "flac",
                "size": "24.96M"
              }
            ],
            "_qualitys": {
              "128k": {
                "size": "3.67M"
              },
              "320k": {
                "size": "9.16M"
              },
              "flac": {
                "size": "24.96M"
              }
            }
          }
        }
      },
      "album": {
        "ok": true,
        "elapsedMs": 77,
        "value": {
          "info": {
            "id": "003DFRzD192KKD",
            "name": "七里香",
            "cover": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
            "description": "",
            "author": ""
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "tx_004WrpV81DMGHv",
                "name": "我的地盘",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:04",
                "meta": {
                  "songId": "004WrpV81DMGHv",
                  "albumName": "七里香",
                  "id": 102065755,
                  "strMediaMid": "0025nWDH4PCVfs",
                  "albumId": "003DFRzD192KKD",
                  "albumMid": "003DFRzD192KKD",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.73M"
                    },
                    {
                      "type": "320k",
                      "size": "9.34M"
                    },
                    {
                      "type": "flac",
                      "size": "27.67M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.73M"
                    },
                    "320k": {
                      "size": "9.34M"
                    },
                    "flac": {
                      "size": "27.67M"
                    }
                  }
                }
              },
              {
                "id": "tx_004Z8Ihr0JIu5s",
                "name": "七里香",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:59",
                "meta": {
                  "songId": "004Z8Ihr0JIu5s",
                  "albumName": "七里香",
                  "id": 102065756,
                  "strMediaMid": "0012Ez0a1tFcOI",
                  "albumId": "003DFRzD192KKD",
                  "albumMid": "003DFRzD192KKD",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.57M"
                    },
                    {
                      "type": "320k",
                      "size": "11.42M"
                    },
                    {
                      "type": "flac",
                      "size": "34.19M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.57M"
                    },
                    "320k": {
                      "size": "11.42M"
                    },
                    "flac": {
                      "size": "34.19M"
                    }
                  }
                }
              }
            ]
          },
          "total": 10,
          "page": 1,
          "limit": 10,
          "source": "tx"
        }
      },
      "singer": {
        "ok": true,
        "elapsedMs": 47,
        "value": {
          "info": {
            "id": "0025NhlN2yWrP4",
            "name": "周杰伦",
            "cover": "https://y.gtimg.cn/music/photo_new/T001R500x500M0000025NhlN2yWrP4.jpg",
            "description": "",
            "author": ""
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "tx_0039MnYb0qxYhV",
                "name": "晴天",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:29",
                "meta": {
                  "songId": "0039MnYb0qxYhV",
                  "albumName": "叶惠美",
                  "id": 97773,
                  "strMediaMid": "003Qui1q2u1Zho",
                  "albumId": "000MkMni19ClKG",
                  "albumMid": "000MkMni19ClKG",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000000MkMni19ClKG.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.12M"
                    },
                    {
                      "type": "320k",
                      "size": "10.29M"
                    },
                    {
                      "type": "flac",
                      "size": "52.83M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.12M"
                    },
                    "320k": {
                      "size": "10.29M"
                    },
                    "flac": {
                      "size": "52.83M"
                    }
                  }
                }
              },
              {
                "id": "tx_001Bbywq2gicae",
                "name": "搁浅",
                "singer": "周杰伦",
                "source": "tx",
                "interval": "04:00",
                "meta": {
                  "songId": "001Bbywq2gicae",
                  "albumName": "七里香",
                  "id": 102065750,
                  "strMediaMid": "004UlK9x0jeuow",
                  "albumId": "003DFRzD192KKD",
                  "albumMid": "003DFRzD192KKD",
                  "singerIds": [
                    "0025NhlN2yWrP4"
                  ],
                  "picUrl": "https://y.gtimg.cn/music/photo_new/T002R500x500M000003DFRzD192KKD.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.67M"
                    },
                    {
                      "type": "320k",
                      "size": "9.16M"
                    },
                    {
                      "type": "flac",
                      "size": "24.96M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.67M"
                    },
                    "320k": {
                      "size": "9.16M"
                    },
                    "flac": {
                      "size": "24.96M"
                    }
                  }
                }
              }
            ]
          },
          "total": 1012,
          "page": 1,
          "limit": 10,
          "source": "tx"
        }
      },
      "searchPaging": {
        "ok": true,
        "value": {
          "page1": [
            "tx_001Bbywq2gicae",
            "tx_0039MnYb0qxYhV",
            "tx_0027oMO61wWi55",
            "tx_001zMQr71F1Qo8",
            "tx_001xd0HI0X9GNq"
          ],
          "page2": [
            "tx_003aAYrm3GE0Ac",
            "tx_003xv4w313tZHV",
            "tx_002qU5aY3Qu24y",
            "tx_003KtYhg4frNXC",
            "tx_004Z8Ihr0JIu5s"
          ]
        }
      }
    },
    "wy": {
      "search": {
        "ok": true,
        "elapsedMs": 370,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "wy_509781655",
                "name": "想你就写信 (Live)",
                "singer": "周杰伦、李硕、张鑫",
                "source": "wy",
                "interval": "03:58",
                "meta": {
                  "songId": 509781655,
                  "albumName": "中国新歌声第二季 第13期",
                  "albumId": 36412633,
                  "singerIds": [
                    "6452",
                    "12010120",
                    "12319226"
                  ],
                  "picUrl": "http://p1.music.126.net/yD9vbpuILH-tqNRIaP640g==/109951163038292176.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.64M"
                    },
                    {
                      "type": "320k",
                      "size": "9.11M"
                    },
                    {
                      "type": "flac",
                      "size": "26.13M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.64M"
                    },
                    "320k": {
                      "size": "9.11M"
                    },
                    "flac": {
                      "size": "26.13M"
                    }
                  }
                }
              },
              {
                "id": "wy_5257138",
                "name": "屋顶",
                "singer": "周杰伦、温岚、吴宗宪",
                "source": "wy",
                "interval": "05:19",
                "meta": {
                  "songId": 5257138,
                  "albumName": "男女情歌对唱冠军全记录",
                  "albumId": 512175,
                  "singerIds": [
                    "6452",
                    "9612",
                    "5360"
                  ],
                  "picUrl": "http://p1.music.126.net/81BsxxhomJ4aJZYvEbyPkw==/109951165671182684.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.87M"
                    },
                    {
                      "type": "320k",
                      "size": "12.17M"
                    },
                    {
                      "type": "flac",
                      "size": "61.59M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.87M"
                    },
                    "320k": {
                      "size": "12.17M"
                    },
                    "flac": {
                      "size": "61.59M"
                    }
                  }
                }
              }
            ]
          },
          "total": 271,
          "page": 1,
          "limit": 5,
          "source": "wy"
        }
      },
      "playlists": {
        "ok": true,
        "elapsedMs": 329,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "18271967084",
              "source": "wy",
              "name": "欧美R&B｜“顶级旋律 开口沦陷”",
              "cover": "http://p2.music.126.net/x-UpYAXLd0C9VqZz087z_w==/109951173781501220.jpg",
              "author": "Buradarrr",
              "description": "【持续更新】欢迎投稿，此歌单汇集欧美R&B之精华，适合在运动、工作、聚会时播放。旋律动听，情感丰富，无论是期待还是遗憾，都能找到共鸣。特别是男女声演绎的经典R&B和当代R&B歌曲，让你沉浸其中，感受旋律的力量。",
              "playCount": 69937
            },
            {
              "id": "18180542999",
              "source": "wy",
              "name": "美式欧美说唱 | 慵懒旋律松弛感",
              "cover": "http://p2.music.126.net/BDu_ylGVe6CRM4lSY5xjHg==/109951173639335878.jpg",
              "author": "Buradarrr",
              "description": "【持续更新】欢迎投稿，慵懒的旋律中夹杂着深情的说唱，适合在独自驾车、悠闲跑步或放松心情时播放。歌曲风格多样，从轻快到悲伤，总有一首能触动你的心弦。",
              "playCount": 19558
            }
          ]
        }
      },
      "boards": {
        "ok": true,
        "elapsedMs": 300,
        "value": {
          "count": 64,
          "sample": [
            {
              "id": "19723756",
              "name": "飙升榜"
            },
            {
              "id": "3779629",
              "name": "新歌榜"
            }
          ]
        }
      },
      "hot": {
        "ok": true,
        "elapsedMs": 308,
        "value": {
          "count": 20,
          "sample": [
            "我不难过",
            "天龙八部之宿敌"
          ]
        }
      },
      "lyrics": {
        "ok": true,
        "elapsedMs": 39,
        "value": {
          "lyric": {
            "characters": 1014,
            "sample": "{\"t\":0,\"c\":[{\"tx\":\"作词: \"},{\"tx\":\"方文山\",\"li\":\"http://p1.music.126.net/oZuIuRb96KNl-Mdz0Jgnsg==/18799449813253750.jpg\",\"or\":\"orpheus://nm/artist/home?id=12203406&type=artist\"}]}\n{\"t\":1000,\"c\":[{\"tx\":\"作曲:"
          },
          "tlyric": "",
          "rlyric": ""
        }
      },
      "comments": {
        "ok": true,
        "elapsedMs": 172,
        "value": {
          "count": 20,
          "sample": [
            {
              "id": "9663537094",
              "author": "爱本质难",
              "avatar": "http://p2.music.126.net/POwZb2mbWGJGPIbQpaucxQ==/109951174041388122.jpg",
              "text": "求求",
              "time": "2026/10/13 00:49:40",
              "likes": 0
            },
            {
              "id": "9663543937",
              "author": "爱本质难",
              "avatar": "http://p2.music.126.net/POwZb2mbWGJGPIbQpaucxQ==/109951174041388122.jpg",
              "text": "求求[流泪]",
              "time": "2026/10/13 00:49:16",
              "likes": 0
            }
          ]
        }
      },
      "page2": {
        "ok": true,
        "elapsedMs": 132,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "wy_255020",
                "name": "刀马旦",
                "singer": "李玟、周杰伦",
                "source": "wy",
                "interval": "03:12",
                "meta": {
                  "songId": 255020,
                  "albumName": "Promise",
                  "albumId": 25475,
                  "singerIds": [
                    "8331",
                    "6452"
                  ],
                  "picUrl": "http://p1.music.126.net/dDgHDWlJAFwkMNrjbQExIA==/109951165959446596.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.93M"
                    },
                    {
                      "type": "320k",
                      "size": "7.33M"
                    },
                    {
                      "type": "flac",
                      "size": "22.74M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.93M"
                    },
                    "320k": {
                      "size": "7.33M"
                    },
                    "flac": {
                      "size": "22.74M"
                    }
                  }
                }
              },
              {
                "id": "wy_210062",
                "name": "骑士精神",
                "singer": "蔡依林、周杰伦",
                "source": "wy",
                "interval": "04:17",
                "meta": {
                  "songId": 210062,
                  "albumName": "看我72变",
                  "albumId": 21349,
                  "singerIds": [
                    "7219",
                    "6452"
                  ],
                  "picUrl": "http://p1.music.126.net/8D2Pd7EuvGboMyE2xWc47A==/109951172453712025.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.93M"
                    },
                    {
                      "type": "320k",
                      "size": "9.83M"
                    },
                    {
                      "type": "flac",
                      "size": "30.40M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.93M"
                    },
                    "320k": {
                      "size": "9.83M"
                    },
                    "flac": {
                      "size": "30.40M"
                    }
                  }
                }
              }
            ]
          },
          "total": 271,
          "page": 2,
          "limit": 5,
          "source": "wy"
        }
      },
      "playlistDetail": {
        "ok": true,
        "elapsedMs": 248,
        "value": {
          "info": {
            "id": "18271967084",
            "source": "wy",
            "name": "欧美R&B｜“顶级旋律 开口沦陷”",
            "cover": "https://p1.music.126.net/x-UpYAXLd0C9VqZz087z_w==/109951173781501220.jpg",
            "author": "Buradarrr",
            "description": "【持续更新】欢迎投稿，此歌单汇集欧美R&B之精华，适合在运动、工作、聚会时播放。旋律动听，情感丰富，无论是期待还是遗憾，都能找到共鸣。特别是男女声演绎的经典R&B和当代R&B歌曲，让你沉浸其中，感受旋律的力量。",
            "playCount": 69937
          },
          "tracks": {
            "count": 98,
            "sample": [
              {
                "id": "wy_19827042",
                "name": "Call You Tonight",
                "singer": "Whitney Houston",
                "source": "wy",
                "interval": "04:10",
                "meta": {
                  "songId": 19827042,
                  "albumName": "I Look To You",
                  "albumId": 1830939,
                  "singerIds": [
                    "84061"
                  ],
                  "picUrl": "https://p2.music.126.net/0rCqvshmixfyHpQYxd1LsQ==/109951165987301859.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.82M"
                    },
                    {
                      "type": "320k",
                      "size": "9.54M"
                    },
                    {
                      "type": "flac",
                      "size": "29.62M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.82M"
                    },
                    "320k": {
                      "size": "9.54M"
                    },
                    "flac": {
                      "size": "29.62M"
                    }
                  }
                }
              },
              {
                "id": "wy_2675114848",
                "name": "PIMMIE'S DILEMMA",
                "singer": "Pimmie、PARTYNEXTDOOR、Drake",
                "source": "wy",
                "interval": "01:58",
                "meta": {
                  "songId": 2675114848,
                  "albumName": "$ome $exy $ongs 4 U",
                  "albumId": 262860582,
                  "singerIds": [
                    "97210806",
                    "774292",
                    "53283"
                  ],
                  "picUrl": "https://p2.music.126.net/glqj1sS52FTVFucMEj9zcQ==/109951173972156676.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "1.80M"
                    },
                    {
                      "type": "320k",
                      "size": "4.51M"
                    },
                    {
                      "type": "flac",
                      "size": "8.79M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "19.48M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "1.80M"
                    },
                    "320k": {
                      "size": "4.51M"
                    },
                    "flac": {
                      "size": "8.79M"
                    },
                    "flac24bit": {
                      "size": "19.48M"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      "boardTracks": {
        "ok": true,
        "elapsedMs": 270,
        "value": {
          "list": {
            "count": 100,
            "sample": [
              {
                "id": "wy_1457113272",
                "name": "故里逢春",
                "singer": "阿YueYue",
                "source": "wy",
                "interval": "03:38",
                "meta": {
                  "songId": 1457113272,
                  "albumName": "故里逢春",
                  "albumId": 93113910,
                  "singerIds": [
                    "12227865"
                  ],
                  "picUrl": "http://p1.music.126.net/8j9BFTx2TpbojM26l3RSiQ==/109951165178496319.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.34M"
                    },
                    {
                      "type": "320k",
                      "size": "8.34M"
                    },
                    {
                      "type": "flac",
                      "size": "42.66M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.34M"
                    },
                    "320k": {
                      "size": "8.34M"
                    },
                    "flac": {
                      "size": "42.66M"
                    }
                  }
                }
              },
              {
                "id": "wy_3372052257",
                "name": "学功夫练武术",
                "singer": "概念黁",
                "source": "wy",
                "interval": "01:38",
                "meta": {
                  "songId": 3372052257,
                  "albumName": "Kung Fu Jumpstyle",
                  "albumId": 371884642,
                  "singerIds": [
                    "31165554"
                  ],
                  "picUrl": "http://p1.music.126.net/KliaeKISrdtzwpIHWjcIuA==/109951173089315216.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "1.51M"
                    },
                    {
                      "type": "320k",
                      "size": "3.77M"
                    },
                    {
                      "type": "flac",
                      "size": "19.88M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "1.51M"
                    },
                    "320k": {
                      "size": "3.77M"
                    },
                    "flac": {
                      "size": "19.88M"
                    }
                  }
                }
              }
            ]
          },
          "total": 100,
          "page": 1,
          "limit": 100,
          "source": "wy"
        }
      },
      "playlistSearch": {
        "ok": true,
        "elapsedMs": 128,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "6792103822",
                "source": "wy",
                "name": "周杰伦-Jay 『网易云精选』",
                "cover": "http://p1.music.126.net/WFQ4EKF5QabD33U3NUOPWQ==/109951169535051638.jpg",
                "author": "Buradarrr",
                "description": "【持续更新】欢迎投稿，每一首歌曲都是大海捞针找的希望喜欢，不喜勿喷！每一首都有独特的情绪和故事铺陈，聆听这段时光音景——如同你内心最真实的回响独白。\n\n封面：周杰伦\n\n感谢网易云，感谢官方。",
                "playCount": 33783276
              },
              {
                "id": "10057662169",
                "source": "wy",
                "name": "周杰伦全免费听",
                "cover": "http://p1.music.126.net/81CiiInNcgv6fwA4uuei1A==/109951169594663161.jpg",
                "author": "念着倒才傻n186",
                "description": "周杰伦的歌如同一幅美丽的风景画，旋律、风景、歌词和情感相互交融，让人沉醉其中",
                "playCount": 3765253
              }
            ]
          },
          "total": 463,
          "page": 1,
          "limit": 5,
          "source": "wy"
        }
      },
      "tags": {
        "ok": true,
        "elapsedMs": 41,
        "value": {
          "count": 70,
          "sample": [
            {
              "id": "综艺",
              "name": "综艺",
              "group": "主题"
            },
            {
              "id": "流行",
              "name": "流行",
              "group": "风格"
            }
          ]
        }
      },
      "taggedPlaylists": {
        "ok": true,
        "elapsedMs": 105,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "4991155974",
              "source": "wy",
              "name": "音综流行热歌 | 孙楠,满江,张彬彬,曾辉和300首精选音综现场",
              "cover": "http://p1.music.126.net/UXO8BPuaSNc9QRFOdDwDtQ==/109951174082599136.jpg?imageView=1&thumbnail=800y800&enlarge=1%7CimageView=1&watermark&type=1&image=b2JqL3dvbkRsc0tVd3JMQ2xHakNtOEt4LzI3NjEwNDk3MDYyL2VlOTMvOTIxYS82NjE4LzdhMDc5ZDg0NTYyMDAwZmVkZWJmMjVjYjE4NjhkOWEzLnBuZw==&dx=0&dy=0%7CimageView=1&thumbnail=140y140&",
              "author": "云音乐官方歌单",
              "description": "300+首高音质Live 紧握时下流行音综趋势",
              "playCount": 28346036
            },
            {
              "id": "13953060640",
              "source": "wy",
              "name": "声入人心 | 音乐剧入门必看神级音综",
              "cover": "http://p1.music.126.net/JuGWTryD8lq7p7N0qgK9Ag==/109951171428062034.jpg?imageView=1&thumbnail=800y800&enlarge=1%7CimageView=1&watermark&type=1&image=b2JqL3c1bkRrTUtRd3JMRGpEekNtOE9tLzYxMDk1MjQ1NzAwLzE0MTQvMjAyNTYxMDExMTEyNy94NDkzMTc1MjExNzA4Njk5OC5wbmc=&dx=0&dy=0%7Cwatermark&type=1&image=b2JqL3dvbkRsc0tVd3JMQ2xHakNtOEt4LzI3NjEwNDk3MDYyL2VlOTMvOTIxYS82NjE4LzdhMDc5ZDg0NTYyMDAwZmVkZWJmMjVjYjE4NjhkOWEzLnBuZw==&dx=0&dy=0%7CimageView=1&thumbnail=140y140&",
              "author": "云音乐全球热歌",
              "description": "《声入人心》作为一档原创励志声乐竞演节目，用年轻时尚的顶尖水准美声音乐剧表演，颠覆大众对高雅音乐的固有印象，引领观众感知声乐艺术独特的魅力。",
              "playCount": 29356
            }
          ]
        }
      },
      "playlistsPage2": {
        "ok": true,
        "elapsedMs": 85,
        "value": {
          "count": 24,
          "sample": [
            {
              "id": "17399268201",
              "source": "wy",
              "name": "戴上耳机『用日系旋律|逃离这个世界吧~』",
              "cover": "http://p1.music.126.net/WzK1DGOjKRphxROW9JAOJw==/109951172761610964.jpg",
              "author": "留下你的真心",
              "description": "这里是我私藏的日系旋律：轻柔唱腔、婉转曲调，藏着细碎的欢喜与治愈。\n大多时候听不懂歌词，却能被音符轻易戳中心事——疲惫、独处时，一首歌就能抚平浮躁。\n\n· 持续更新中，好歌不断\n· 欢迎在评论区推荐好听的日语歌，会收进歌单\n· 建议开启「淡入淡出」，曲目衔接更顺滑（评论区有教程）\n· 戴上耳机效果最佳，收藏不亏",
              "playCount": 43775
            },
            {
              "id": "18359211192",
              "source": "wy",
              "name": "欧美emo独享｜破碎感深夜伤感旋律",
              "cover": "http://p1.music.126.net/XtBk-KKRHFBHI87HZE9ljQ==/109951173904350931.jpg",
              "author": "Buradarrr",
              "description": "【持续更新】欢迎投稿，这款深夜伤感旋律歌单，以破碎的情感为主题，将深夜伤感氛围推向极致。适合独处时聆听，无论是回望过去还是展望未来，都能在悠扬的旋律中找到共鸣。音乐风格多元，既有温暖治愈的温柔之音，也有唤醒内心深处哀愁的力量。这不仅仅是一份歌单，更像是一段灵魂之旅。",
              "playCount": 670
            }
          ]
        }
      },
      "playlistPaging": {
        "ok": true,
        "value": {
          "page1": [
            "18271967084",
            "18180542999",
            "18374591158"
          ],
          "page2": [
            "17399268201",
            "18359211192",
            "18202524533"
          ]
        }
      },
      "newPlaylists": {
        "ok": false,
        "elapsedMs": 33,
        "error": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 平台未返回可用歌单，此发现接口暂不可用"
      },
      "suggestions": {
        "ok": true,
        "elapsedMs": 59,
        "value": {
          "count": 4,
          "sample": [
            "布拉格广场",
            "屋顶"
          ]
        }
      },
      "details": {
        "ok": true,
        "elapsedMs": 45,
        "value": {
          "id": "wy_509781655",
          "name": "想你就写信 (Live)",
          "singer": "周杰伦、李硕、张鑫",
          "source": "wy",
          "interval": "03:58",
          "meta": {
            "songId": 509781655,
            "albumName": "中国新歌声第二季 第13期",
            "albumId": 36412633,
            "singerIds": [
              "6452",
              "12010120",
              "12319226"
            ],
            "picUrl": "https://p2.music.126.net/yD9vbpuILH-tqNRIaP640g==/109951163038292176.jpg",
            "qualitys": [
              {
                "type": "128k",
                "size": "3.64M"
              },
              {
                "type": "320k",
                "size": "9.11M"
              },
              {
                "type": "flac",
                "size": "26.13M"
              }
            ],
            "_qualitys": {
              "128k": {
                "size": "3.64M"
              },
              "320k": {
                "size": "9.11M"
              },
              "flac": {
                "size": "26.13M"
              }
            }
          }
        }
      },
      "album": {
        "ok": true,
        "elapsedMs": 93,
        "value": {
          "info": {
            "id": "36412633",
            "name": "中国新歌声第二季 第13期",
            "cover": "https://p2.music.126.net/yD9vbpuILH-tqNRIaP640g==/109951163038292176.jpg",
            "description": "",
            "author": "[object Object]"
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "wy_509781651",
                "name": "乌克丽丽 (Live)",
                "singer": "周杰伦、陈颖恩、肖邦妮、朱文婷",
                "source": "wy",
                "interval": "03:13",
                "meta": {
                  "songId": 509781651,
                  "albumName": "中国新歌声第二季 第13期",
                  "albumId": 36412633,
                  "singerIds": [
                    "6452",
                    "27819671",
                    "29780520",
                    "12788261"
                  ],
                  "picUrl": "https://p2.music.126.net/yD9vbpuILH-tqNRIaP640g==/109951163038292176.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.95M"
                    },
                    {
                      "type": "320k",
                      "size": "7.38M"
                    },
                    {
                      "type": "flac",
                      "size": "23.10M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.95M"
                    },
                    "320k": {
                      "size": "7.38M"
                    },
                    "flac": {
                      "size": "23.10M"
                    }
                  }
                }
              },
              {
                "id": "wy_509781652",
                "name": "夜空中最亮的星 (Live)",
                "singer": "群星",
                "source": "wy",
                "interval": "03:46",
                "meta": {
                  "songId": 509781652,
                  "albumName": "中国新歌声第二季 第13期",
                  "albumId": 36412633,
                  "singerIds": [
                    "122455"
                  ],
                  "picUrl": "https://p2.music.126.net/yD9vbpuILH-tqNRIaP640g==/109951163038292176.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.46M"
                    },
                    {
                      "type": "320k",
                      "size": "8.65M"
                    },
                    {
                      "type": "flac",
                      "size": "27.62M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.46M"
                    },
                    "320k": {
                      "size": "8.65M"
                    },
                    "flac": {
                      "size": "27.62M"
                    }
                  }
                }
              }
            ]
          },
          "total": 16,
          "page": 1,
          "limit": 10,
          "source": "wy"
        }
      },
      "singer": {
        "ok": true,
        "elapsedMs": 88,
        "value": {
          "info": {
            "id": "6452",
            "name": "周杰伦",
            "cover": "http://p1.music.126.net/NWv6PtSBkyWZzqbJVzBr7g==/109951169164936450.jpg",
            "description": "周杰伦（Jay Chou），1979年1月18日出生于台湾省新北市，祖籍福建省永春县，华语流行乐男歌手、音乐人、演员、导演，毕业于淡江中学 。\n2000年，发行个人首张音乐专辑《Jay》 ，并在华语乐坛获得广泛关注 。2001年，凭借音乐专辑《范特西》奠定其在乐坛的地位 ，并获得三座台湾金曲奖 [38]。2003年，登上美国《时代》杂志封面 ；此后，推出《叶惠美》《七里香》《11月的萧邦》《依然范特西》等商业与口碑兼具的音乐专辑 。2005年，主演个人首部电影《头文字D》 ，凭借该片获得香港电影金像奖和台湾电影金马奖“最佳新演员奖” 。2007年，成立“杰威尔音乐有限公司” ，首度自编自导并领衔主演爱情片《不能说的秘密》 。2009年起，凭借音乐专辑《魔杰座》和《跨时代》两度获得台湾金曲奖“最佳国语男歌手奖” ；之后，持续产出作品并举行巡演 。2023年，凭借音乐专辑《最伟大的作品》成为首位获得全球年度销量冠军的华语歌手 。2024年，成为首位在台北大巨蛋开唱的歌手 。2026年，发行音乐专辑《太阳之子》。\n周杰伦共获得15座台湾金曲奖，是获得该奖最多的音乐人 。他四次获得世界音乐大奖“中国区最畅销艺人奖” 、两次获得MTV亚洲大奖“最受欢迎歌手奖” ，并被美国CNN评为“25位亚洲最具影响力人物”之一 、被《Fast Company》杂志评为“全球百大创意人物”之一 。作为音乐人，他为自己的所有原唱歌曲作曲并担任制作人 ，更将R&B、嘻哈等风格的唱法与中国传统音乐融合，使得“中国风”这一名词登上流行音乐行列",
            "author": ""
          },
          "list": {
            "count": 10,
            "sample": [
              {
                "id": "wy_298317",
                "name": "屋顶",
                "singer": "温岚、周杰伦",
                "source": "wy",
                "interval": "05:19",
                "meta": {
                  "songId": 298317,
                  "albumName": "有点野",
                  "albumId": 29597,
                  "singerIds": [
                    "9612",
                    "6452"
                  ],
                  "picUrl": "https://p1.music.126.net/t1KaAJmIphZKdPq8JfItbA==/109951170514287417.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": null
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": null
                    }
                  }
                }
              },
              {
                "id": "wy_210049",
                "name": "布拉格广场",
                "singer": "蔡依林、周杰伦",
                "source": "wy",
                "interval": "04:54",
                "meta": {
                  "songId": 210049,
                  "albumName": "看我72变",
                  "albumId": 21349,
                  "singerIds": [
                    "7219",
                    "6452"
                  ],
                  "picUrl": "https://p1.music.126.net/8D2Pd7EuvGboMyE2xWc47A==/109951172453712025.jpg",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": null
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": null
                    }
                  }
                }
              }
            ]
          },
          "total": 566,
          "page": 1,
          "limit": 10,
          "source": "wy"
        }
      },
      "searchPaging": {
        "ok": true,
        "value": {
          "page1": [
            "wy_509781655",
            "wy_5257138",
            "wy_210049",
            "wy_1888354230",
            "wy_490595315"
          ],
          "page2": [
            "wy_255020",
            "wy_210062",
            "wy_209917",
            "wy_490602323",
            "wy_1317494434"
          ]
        }
      }
    },
    "mg": {
      "search": {
        "ok": true,
        "elapsedMs": 376,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "mg_60054704965",
                "name": "圣诞星（feat. 杨瑞代）",
                "singer": "周杰伦",
                "source": "mg",
                "interval": "03:02",
                "meta": {
                  "songId": "60054704965",
                  "albumName": "圣诞星",
                  "id": "1140505222",
                  "contentId": "600929000000096577",
                  "copyrightId": "60054704965",
                  "albumId": "1140505221",
                  "singerIds": [
                    "112"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5u/7q/959ba4e19cf64d488f1f623f95892bf2.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2t/1l/38a861e9806641448f8cab425b1f2b18",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.79M"
                    },
                    {
                      "type": "320k",
                      "size": "6.97M"
                    },
                    {
                      "type": "flac",
                      "size": "18.93M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "35.34M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.79M"
                    },
                    "320k": {
                      "size": "6.97M"
                    },
                    "flac": {
                      "size": "18.93M"
                    },
                    "flac24bit": {
                      "size": "35.34M"
                    }
                  }
                }
              },
              {
                "id": "mg_6902739Z01T",
                "name": "圣诞星 (feat. 杨瑞代)",
                "singer": "周杰伦、杨瑞代",
                "source": "mg",
                "interval": "03:01",
                "meta": {
                  "songId": "6902739Z01T",
                  "albumName": "太阳之子",
                  "id": "1142543097",
                  "contentId": "600919000007816342",
                  "copyrightId": "6902739Z01T",
                  "albumId": "1142521343",
                  "singerIds": [
                    "112",
                    "75073"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5k/zu/3c5e83605c694669b740491c0df8a0dc.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5l/4x/e35440950dfe4d3da3426528c4d9f5c1",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.77M"
                    },
                    {
                      "type": "320k",
                      "size": "6.92M"
                    },
                    {
                      "type": "flac",
                      "size": "20.05M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "36.47M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.77M"
                    },
                    "320k": {
                      "size": "6.92M"
                    },
                    "flac": {
                      "size": "20.05M"
                    },
                    "flac24bit": {
                      "size": "36.47M"
                    }
                  }
                }
              }
            ]
          },
          "total": 149,
          "page": 1,
          "limit": 5,
          "source": "mg"
        }
      },
      "playlists": {
        "ok": true,
        "elapsedMs": 447,
        "value": {
          "count": 30,
          "sample": [
            {
              "id": "236720822",
              "source": "mg",
              "name": "〔深度·那英〕征服岁月，唱尽深情",
              "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/pt/0303f4a7347f4c9cb3454e737303d022.png",
              "author": "",
              "description": "华语乐坛当之无愧的“金曲天后”，她的嗓音极具辨识度，大气磅礴中带着直击人心的力量。“那氏情歌”总能在不经意间唱透你的心事。聆听那英，在她的歌声里找寻那些关于爱与释怀的故事。",
              "playCount": 0
            },
            {
              "id": "236718585",
              "source": "mg",
              "name": "〔深度·伍佰 & China Blue〕铁汉柔情，摇滚诗心",
              "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/pt/8e21239dd1a442d98060d94bd4b8d30d.png",
              "author": "",
              "description": "只要他拨动吉他琴弦，便是万人大合唱的狂欢。伍佰的音乐，既有粗犷狂野的摇滚力量，又藏着细腻动人的“铁汉柔情”。点击播放，一起感受华语乐坛独一无二的极致浪漫与洒脱。",
              "playCount": 0
            }
          ]
        }
      },
      "boards": {
        "ok": true,
        "elapsedMs": 466,
        "value": {
          "count": 9,
          "sample": [
            {
              "id": "83048887",
              "name": "全网热歌榜"
            },
            {
              "id": "83049014",
              "name": "抖音热歌榜"
            }
          ]
        }
      },
      "hot": {
        "ok": false,
        "elapsedMs": 17,
        "error": "page.evaluate: Error: Error invoking remote method 'chenjin:invoke': Error: 咪咕此版本暂未提供受支持的公开热搜接口"
      },
      "lyrics": {
        "ok": true,
        "elapsedMs": 44,
        "value": {
          "lyric": {
            "characters": 1070,
            "sample": "[00:04.00]圣诞星（feat. 杨瑞代） - 周杰伦\r\n[00:17.50]驯鹿的响铃和雪花的相遇\r\n[00:21.00]当作是我对你离开描绘的旋律\r\n[00:24.55]柴火写了序暖和童话的过去\r\n[00:31.44]远方的烟囱冒着烟\r\n[00:33.50]该不会是我的卡片(我的卡片） \r\n[00:35.75]那是我让圣诞老人\r\n[00:37.45]捎去的想念（捎去的想念） \r\n[00:"
          }
        }
      },
      "comments": {
        "ok": true,
        "elapsedMs": 453,
        "value": {
          "count": 20,
          "sample": [
            {
              "id": "139667114",
              "author": "L.M",
              "avatar": "https://pl.nf.migu.cn/group2/M01/05/0B/CrUBJGpwCZ-IKU0iAABQ6v4DHaMAABIggG8EisAAFEC891.jpg",
              "text": "👍",
              "time": "2026-10-10 19:36",
              "likes": 0
            },
            {
              "id": "139653917",
              "author": "丨个哈哈哈哈那江南的事情了吗大家你们的人呢人",
              "avatar": "https://pl.nf.migu.cn/group2/M00/00/03/CrUBJGEUGoaIAE6OAAEcEZgZzuYAAAG1gDrZiEAARwp48.jpeg",
              "text": "😍😍😍",
              "time": "2026-10-10 16:32",
              "likes": 0
            }
          ]
        }
      },
      "page2": {
        "ok": true,
        "elapsedMs": 119,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "mg_60054701900",
                "name": "简单爱",
                "singer": "周杰伦",
                "source": "mg",
                "interval": "04:31",
                "meta": {
                  "songId": "60054701900",
                  "albumName": "范特西",
                  "id": "1115764399",
                  "contentId": "600902000006889458",
                  "copyrightId": "60054701900",
                  "albumId": "7948",
                  "singerIds": [
                    "112"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5w/p6/bbb92a1f71344c15be758e1835d7954e.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2o/ct/99",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.14M"
                    },
                    {
                      "type": "320k",
                      "size": "10.34M"
                    },
                    {
                      "type": "flac",
                      "size": "30.93M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "57.35M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.14M"
                    },
                    "320k": {
                      "size": "10.34M"
                    },
                    "flac": {
                      "size": "30.93M"
                    },
                    "flac24bit": {
                      "size": "57.35M"
                    }
                  }
                }
              },
              {
                "id": "mg_60054704515",
                "name": "简单爱  (Live)",
                "singer": "周杰伦",
                "source": "mg",
                "interval": "04:33",
                "meta": {
                  "songId": "60054704515",
                  "albumName": "The One演唱会",
                  "id": "1104959493",
                  "contentId": "600919000007741284",
                  "copyrightId": "60054704515",
                  "albumId": "26187",
                  "singerIds": [
                    "112"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5k/yo/cd5ea63c1aa24e9ea321fcd5e6c498ca.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/1w/98/an",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.17M"
                    },
                    {
                      "type": "320k",
                      "size": "10.43M"
                    },
                    {
                      "type": "flac",
                      "size": "34.75M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.17M"
                    },
                    "320k": {
                      "size": "10.43M"
                    },
                    "flac": {
                      "size": "34.75M"
                    }
                  }
                }
              }
            ]
          },
          "total": 149,
          "page": 2,
          "limit": 5,
          "source": "mg"
        }
      },
      "playlistDetail": {
        "ok": true,
        "elapsedMs": 451,
        "value": {
          "info": {
            "id": "236720822",
            "source": "mg",
            "name": "〔深度·那英〕征服岁月，唱尽深情",
            "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/pt/0303f4a7347f4c9cb3454e737303d022.png",
            "author": "咪咕音乐官方账号",
            "description": "华语乐坛当之无愧的“金曲天后”，她的嗓音极具辨识度，大气磅礴中带着直击人心的力量。“那氏情歌”总能在不经意间唱透你的心事。聆听那英，在她的歌声里找寻那些关于爱与释怀的故事。",
            "playCount": 545103
          },
          "tracks": {
            "count": 100,
            "sample": [
              {
                "id": "mg_69090500783",
                "name": "征服",
                "singer": "那英",
                "source": "mg",
                "interval": "04:59",
                "meta": {
                  "songId": "69090500783",
                  "albumName": "征服",
                  "id": "4264676",
                  "contentId": "600930000001615923",
                  "copyrightId": "69090500783",
                  "albumId": "8381",
                  "singerIds": [
                    "235"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2h/yc/qd.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/60/70/34ee29709e7643f0aeb5d3f1b93e340c",
                  "mrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/60/70/1f0f822db8714347a09bf19bebc6af60",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.06M"
                    },
                    {
                      "type": "320k",
                      "size": "7.66M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.06M"
                    },
                    "320k": {
                      "size": "7.66M"
                    }
                  }
                }
              },
              {
                "id": "mg_6005751T4WG",
                "name": "梦一场(电视剧《新闻小姐》插曲)",
                "singer": "那英",
                "source": "mg",
                "interval": "03:52",
                "meta": {
                  "songId": "6005751T4WG",
                  "albumName": "干脆",
                  "id": "1104709861",
                  "contentId": "600913000003947604",
                  "copyrightId": "6005751T4WG",
                  "albumId": "11879",
                  "singerIds": [
                    "235"
                  ],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2o/0c/y5.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5i/lk/dc4bdc6eaa4944e7b6b9f6e5b5afeb70",
                  "mrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5i/lk/b13595f7a4804ce2a813b3c00ccab9d3",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.55M"
                    },
                    {
                      "type": "320k",
                      "size": "8.87M"
                    },
                    {
                      "type": "flac",
                      "size": "21.52M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "43.67M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.55M"
                    },
                    "320k": {
                      "size": "8.87M"
                    },
                    "flac": {
                      "size": "21.52M"
                    },
                    "flac24bit": {
                      "size": "43.67M"
                    }
                  }
                }
              }
            ]
          }
        }
      },
      "boardTracks": {
        "ok": true,
        "elapsedMs": 141,
        "value": {
          "list": {
            "count": 50,
            "sample": [
              {
                "id": "mg_69053700067",
                "name": "自由的你",
                "singer": "G.E.M.邓紫棋",
                "source": "mg",
                "interval": null,
                "meta": {
                  "songId": "69053700067",
                  "albumName": "自由的你",
                  "id": "1144025199",
                  "contentId": "600930000002751847",
                  "copyrightId": "69053700067",
                  "albumId": "1144025198",
                  "singerIds": [],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/60/za/dbf6aae03bd84250a5c0e842c15822bf.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/60/z5/cb08d470cdec40888e94b8dd2fcd18eb",
                  "mrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/60/z5/8d40c469903043128c6c1d7499ab94f5",
                  "trcUrl": "",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "4.53M"
                    },
                    {
                      "type": "320k",
                      "size": "11.33M"
                    },
                    {
                      "type": "flac",
                      "size": "37.49M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "64.59M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "4.53M"
                    },
                    "320k": {
                      "size": "11.33M"
                    },
                    "flac": {
                      "size": "37.49M"
                    },
                    "flac24bit": {
                      "size": "64.59M"
                    }
                  }
                }
              },
              {
                "id": "mg_6005974L6ZL",
                "name": "甲乙丙丁 (你我怎么两清)",
                "singer": "李佳薇",
                "source": "mg",
                "interval": null,
                "meta": {
                  "songId": "6005974L6ZL",
                  "albumName": "甲乙丙丁",
                  "id": "1142811892",
                  "contentId": "600929000008420331",
                  "copyrightId": "6005974L6ZL",
                  "albumId": "1142811890",
                  "singerIds": [],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5x/2z/2342d1c2818e4eedb9574e004671fdcf.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5x/9i/0849dd8352e043c9b01526991276cff9",
                  "mrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5x/9i/3d4ff21bce78416aa96864350dfb7f32",
                  "trcUrl": "",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "3.21M"
                    },
                    {
                      "type": "320k",
                      "size": "8.03M"
                    },
                    {
                      "type": "flac",
                      "size": "22.00M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "41.27M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "3.21M"
                    },
                    "320k": {
                      "size": "8.03M"
                    },
                    "flac": {
                      "size": "22.00M"
                    },
                    "flac24bit": {
                      "size": "41.27M"
                    }
                  }
                }
              }
            ]
          },
          "total": 50,
          "page": 1,
          "limit": 100,
          "source": "mg"
        }
      },
      "playlistSearch": {
        "ok": true,
        "elapsedMs": 150,
        "value": {
          "list": {
            "count": 5,
            "sample": [
              {
                "id": "233754996",
                "source": "mg",
                "name": "周杰伦精选100首：青春百听不厌",
                "cover": "",
                "author": "山间啊",
                "description": "华语乐坛变了又变，但在我们的耳机里，永远有一个位置留给周杰伦。\n这100首精选，跨越了卡带、CD到MP3的时代，藏着我们回不去的青春。\n按下播放键，时光倒流。有些歌，真的可以百听不厌；有些青春，永远都不会老。🎧✨",
                "playCount": 0
              },
              {
                "id": "233585566",
                "source": "mg",
                "name": "晴天雨天，都是有周杰伦彩铃的每一天",
                "cover": "",
                "author": "说真的奶茶自由战士",
                "description": "那些年，周杰伦的每一首歌，都曾是我们舍不得换掉的彩铃。",
                "playCount": 0
              }
            ]
          },
          "total": 200,
          "page": 1,
          "limit": 5,
          "source": "mg"
        }
      },
      "tags": {
        "ok": true,
        "elapsedMs": 71,
        "value": {
          "count": 75,
          "sample": [
            {
              "id": "1001076096",
              "name": "网络热歌",
              "group": "热门"
            },
            {
              "id": "1000001672",
              "name": "流行",
              "group": "热门"
            }
          ]
        }
      },
      "taggedPlaylists": {
        "ok": true,
        "elapsedMs": 253,
        "value": {
          "count": 30,
          "sample": [
            {
              "id": "210526187",
              "source": "mg",
              "name": "网络流行热歌，越听越上头",
              "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/pf/b76d91c42789474a83f72e509cf62e48.jpeg",
              "author": "",
              "description": "",
              "playCount": 0
            },
            {
              "id": "203686058",
              "source": "mg",
              "name": "网络热歌 | 拨开迷雾抓住你的声音",
              "cover": "https://d.musicapp.migu.cn/data/oss/service66/00/2b/09/6j.webp",
              "author": "",
              "description": "",
              "playCount": 0
            }
          ]
        }
      },
      "playlistsPage2": {
        "ok": true,
        "elapsedMs": 307,
        "value": {
          "count": 30,
          "sample": [
            {
              "id": "236047574",
              "source": "mg",
              "name": "青春序章｜刻进90后DNA的专属旋律",
              "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/pp/b4c5b96fade042558982033d99e9de86.png",
              "author": "",
              "description": "精选陪伴90后一路成长的华语金曲。熟悉的旋律一响，瞬间就把人拉回年少时光。那些藏在青春里的欢喜与遗憾，全都随着歌声慢慢浮现。闲暇之余戴上耳机，重温年少记忆，在熟悉的曲调之中，邂逅那段闪闪发光、再也回不去的青葱岁月。",
              "playCount": 0
            },
            {
              "id": "236047455",
              "source": "mg",
              "name": "车载Kpop：沉浸式循环韩流热单",
              "cover": "https://d.musicapp.migu.cn/data/oss/service98/00/1w/po/72cdd87dea1146d394ecfdf0d0c1b7ed.jpeg",
              "author": "",
              "description": "精选节奏动感的人气K‑pop热曲，适配行车途中循环播放。强劲流畅的节拍，氛围感十足，驱散路途的枯燥乏味。无论是城市通勤还是长途自驾，动感旋律一路相伴。伴着熟悉的韩流节奏，放松心情，让每一段出行旅途都活力满满。",
              "playCount": 0
            }
          ]
        }
      },
      "playlistPaging": {
        "ok": true,
        "value": {
          "page1": [
            "236720822",
            "236718585",
            "236721280"
          ],
          "page2": [
            "236047574",
            "236047455",
            "236047027"
          ]
        }
      },
      "suggestions": {
        "ok": true,
        "elapsedMs": 449,
        "value": {
          "count": 5,
          "sample": [
            "圣诞星（feat. 杨瑞代）",
            "圣诞星 (feat. 杨瑞代)"
          ]
        }
      },
      "details": {
        "ok": true,
        "elapsedMs": 3,
        "value": {
          "id": "mg_60054704965",
          "name": "圣诞星（feat. 杨瑞代）",
          "singer": "周杰伦",
          "source": "mg",
          "interval": "03:02",
          "meta": {
            "songId": "60054704965",
            "albumName": "圣诞星",
            "id": "1140505222",
            "contentId": "600929000000096577",
            "copyrightId": "60054704965",
            "albumId": "1140505221",
            "singerIds": [
              "112"
            ],
            "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5u/7q/959ba4e19cf64d488f1f623f95892bf2.webp",
            "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2t/1l/38a861e9806641448f8cab425b1f2b18",
            "qualitys": [
              {
                "type": "128k",
                "size": "2.79M"
              },
              {
                "type": "320k",
                "size": "6.97M"
              },
              {
                "type": "flac",
                "size": "18.93M"
              },
              {
                "type": "flac24bit",
                "size": "35.34M"
              }
            ],
            "_qualitys": {
              "128k": {
                "size": "2.79M"
              },
              "320k": {
                "size": "6.97M"
              },
              "flac": {
                "size": "18.93M"
              },
              "flac24bit": {
                "size": "35.34M"
              }
            }
          }
        }
      },
      "album": {
        "ok": true,
        "elapsedMs": 72,
        "value": {
          "info": {
            "id": "1140505221",
            "name": "圣诞星",
            "cover": "https://d.musicapp.migu.cn/data/oss/resource/00/5u/7q/d0ebff37292f4a958bb5c193310859d0.webp",
            "description": "如果，宇宙中有我这么一颗『星』\n　　我会希望，是你 发现 我\n　　今年最惊喜的圣诞礼物！\n　　周杰伦Jay Chou\n　　Jay式圣诞小品\n　　圣诞星\n　　有它陪你过圣诞，一个人也可以孤单得很浪漫！\n　　本世纪最浪漫的圣诞小品！在全球歌迷千呼万唤、引颈期盼下，天王周杰伦送给歌迷们这首最惊喜的圣诞礼物「圣诞星」。幸福来得出奇不意，甚至事先连公司都不知道的这首惊喜「圣诞星」，周杰伦笑说自己写过很多跟节日有关的歌，像端午节的「疗伤烧肉粽」、母亲节「听妈妈的话」，关于圣诞节的歌曲还没写过，以后大家听圣诞节的歌曲，除了玛丽亚凯莉的，还有这首歌的选择。而这首歌也是继「等你下课」后，与Gary杨瑞代再度合作，Gary在这首歌中献声，也一同拍摄ＭＶ。\n　　这首「圣诞星」ＭＶ，在独具风味的欧洲小镇取景，以及在充满圣诞节装饰、有壁炉的小木屋里拍摄对嘴画面，周杰伦和杨瑞代与乐手们特别以红色、绿色、格纹、毛衣等穿搭出「圣诞风」造型，更将麦克风架以白色圣诞叶装饰，加上烛光、灯泡灯饰，将整个演唱空间营造出浪漫的圣诞氛围！\n　　这首以「圣诞节」为主题的小品「圣诞星」，描绘在欢乐节庆里「剩单」的心情，原本约好一起共度圣诞的对象，却在这天之前分手了，只好独自一人布置圣诞树，心情就像圣诞树上的星，无人共享；只能写成一首歌，献给世界上每个被落单的人。\n　　我的爱就像圣诞树顶的星星  \n　　装饰完到最后才能够献上真心\n　　等不及的你没有伫留的脚印\n　　依偎怀里的热情已结冰\n　　我的爱就像圣诞树顶的星星\n　　冰天雪地的夜里只为了你证明\n　　你就像头也不回任性的流星\n　　怎么体会极光的美丽\n　　在充满欢乐、跟最爱的人团聚的圣诞节，整个世界都准备着礼物、布置圣诞树，街道变成一片片灯光海，唯美、欢乐的气氛日日彻夜不眠；卡片、许愿、圣诞袜、礼物，这些都只是希望，重要的人此刻能在身边。如果事与愿违，那就代表，你长大了。\n　　长大以后，我们不再相信圣诞老公公的存在，但一定会有一首歌让我们相信，在这个特别的日子里可以不孤单。\n　　今年圣诞节，记得寻找城市中每棵圣诞树上的「圣诞星」，这是Jay Chou要传递给你的浪漫守护",
            "author": "周杰伦"
          },
          "list": {
            "count": 1,
            "sample": [
              {
                "id": "mg_60054704965",
                "name": "圣诞星（feat. 杨瑞代）",
                "singer": "周杰伦",
                "source": "mg",
                "interval": null,
                "meta": {
                  "songId": "60054704965",
                  "albumName": "圣诞星",
                  "id": "1140505222",
                  "contentId": "600929000000096577",
                  "copyrightId": "60054704965",
                  "albumId": "1140505221",
                  "singerIds": [],
                  "picUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/5u/7q/d0ebff37292f4a958bb5c193310859d0.webp",
                  "lrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2t/1l/38a861e9806641448f8cab425b1f2b18",
                  "mrcUrl": "https://d.musicapp.migu.cn/data/oss/resource/00/2t/1l/e90d83efd6554e2880f2275780691718",
                  "trcUrl": "",
                  "qualitys": [
                    {
                      "type": "128k",
                      "size": "2.79M"
                    },
                    {
                      "type": "320k",
                      "size": "6.97M"
                    },
                    {
                      "type": "flac",
                      "size": "18.93M"
                    },
                    {
                      "type": "flac24bit",
                      "size": "35.34M"
                    }
                  ],
                  "_qualitys": {
                    "128k": {
                      "size": "2.79M"
                    },
                    "320k": {
                      "size": "6.97M"
                    },
                    "flac": {
                      "size": "18.93M"
                    },
                    "flac24bit": {
                      "size": "35.34M"
                    }
                  }
                }
              }
            ]
          },
          "total": 1,
          "page": 1,
          "limit": 10,
          "source": "mg"
        }
      },
      "singer": {
        "ok": false,
        "elapsedMs": 2,
        "error": "electronApplication.evaluate: Error: 此平台的歌手详情未提供受支持的公开接口\n    at C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:913:18\n    at detailCached (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:254:19)\n    at Object.getSinger (C:\\Users\\琛瑾喵呜\\AppData\\Local\\Temp\\chenjin-provider-probe-Pb82tp\\providers.cjs:895:10)\n    at eval (eval at evaluate (:370:30), <anonymous>:1:54)\n    at UtilityScript.evaluate (<anonymous>:372:16)\n    at UtilityScript.<anonymous> (<anonymous>:1:44)"
      },
      "searchPaging": {
        "ok": true,
        "value": {
          "page1": [
            "mg_60054704965",
            "mg_6902739Z01T",
            "mg_60054701941",
            "mg_60054704607",
            "mg_60054704382"
          ],
          "page2": [
            "mg_60054701900",
            "mg_60054704515",
            "mg_60054704503",
            "mg_60054701920",
            "mg_60054704416"
          ]
        }
      }
    }
  },
  "aggregate": {
    "ok": true,
    "elapsedMs": 190,
    "value": {
      "list": {
        "count": 25,
        "sample": [
          {
            "id": "kw_228908",
            "name": "晴天",
            "singer": "周杰伦",
            "source": "kw",
            "interval": "04:29",
            "meta": {
              "songId": "228908",
              "albumName": "叶惠美",
              "albumId": "1293",
              "singerIds": [
                "336"
              ],
              "picUrl": null,
              "qualitys": [
                {
                  "type": "flac",
                  "size": "52.83Mb"
                },
                {
                  "type": "320k",
                  "size": "10.29Mb"
                },
                {
                  "type": "128k",
                  "size": "4.12Mb"
                }
              ],
              "_qualitys": {
                "flac": {
                  "size": "52.83Mb"
                },
                "320k": {
                  "size": "10.29Mb"
                },
                "128k": {
                  "size": "4.12Mb"
                }
              }
            }
          },
          {
            "id": "kw_118980",
            "name": "夜曲",
            "singer": "周杰伦",
            "source": "kw",
            "interval": "03:46",
            "meta": {
              "songId": "118980",
              "albumName": "十一月的萧邦",
              "albumId": "14466",
              "singerIds": [
                "336"
              ],
              "picUrl": null,
              "qualitys": [
                {
                  "type": "flac",
                  "size": "25.45Mb"
                },
                {
                  "type": "320k",
                  "size": "8.66Mb"
                },
                {
                  "type": "128k",
                  "size": "3.46Mb"
                }
              ],
              "_qualitys": {
                "flac": {
                  "size": "25.45Mb"
                },
                "320k": {
                  "size": "8.66Mb"
                },
                "128k": {
                  "size": "3.46Mb"
                }
              }
            }
          }
        ]
      },
      "total": 5192,
      "page": 1,
      "limit": 5,
      "source": "all",
      "failures": []
    }
  },
  "finishedAt": "2026-10-12T21:27:51.935Z"
}
```
