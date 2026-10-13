import { registerTranslations } from '../i18n'

export const commentTranslations={
 '歌曲评论':'Song comments','关闭评论':'Close comments','普通评论':'Recent comments','热门评论':'Popular comments','正在读取评论…':'Loading comments…',
 '暂无评论':'No comments yet','暂无热门评论':'No popular comments yet','这一页没有评论，请返回上一页。':'There are no comments on this page. Return to the previous page.',
 '本地歌曲没有平台评论。':'Local songs do not have platform comments.','评论加载失败':'Comments could not be loaded','重试评论':'Retry comments','上一页':'Previous page','下一页':'Next page','评论页码':'Comment page',
 '查看回复':'View replies','收起回复':'Hide replies','正在读取回复…':'Loading replies…','回复加载失败':'Replies could not be loaded','重试回复':'Retry replies','暂无回复':'No replies yet',
 '附带回复':'Included replies','回复内容':'Replies','回复页码':'Reply page','评论图片':'Comment image','评论头像':'Comment avatar','点赞数':'Likes',
 '评论接口没有返回数组':'The comments API did not return an array','回复嵌套已达到显示上限':'Maximum reply nesting reached','平台返回不足20条时停止翻页；没有提供总数。':'Pagination stops when the platform returns fewer than 20 items; no total was provided.',
} as const
registerTranslations(commentTranslations)
