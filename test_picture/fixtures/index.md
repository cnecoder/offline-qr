# 人工测试样张清单

由 `scripts/gen-test-fixtures.mjs` 生成,`npm run fixtures` 可重新生成;`npm run verify:fixtures` 为自动 QA 门禁(全部应通过)。
测试方式:在"识别"Tab 选图/拖拽/粘贴识别;小尺寸图(12)建议全屏显示后用"屏幕选区"测试。

| 文件 | 预期识别结果 | 验证点 |
|---|---|---|
| 01-text-url.png | `https://example.com/qr-manual-test` | 结果卡出现"打开链接" |
| 02-text-chinese.png | 你好,二维码工具!+ 第二行 | 中文识别、多行折叠/展开 |
| 03-text-long.png | 12 行长文本 | 高版本码、长文本折叠 |
| 04-wifi-wpa.png | `WIFI:T:WPA;S:HomeNet;P:pass123;;` | Wi-Fi 格式原样展示 |
| 05-wifi-escaped.png | `WIFI:T:WPA;S:net\;\,\"x;P:p\:a\,s\\s;;` | 转义字符原样输出 |
| 06-wifi-nopass.png | `WIFI:T:nopass;S:OpenNet;;` | 无密码格式 |
| 07-vcard.png | `BEGIN:VCARD…FN:张三…` | vCard 结构 |
| 08-multi-3codes.png | 3 条结果 | 一图多码、逐条复制 |
| 09-low-quality.png | `https://example.com/low-quality` | 低质量图鲁棒性 |
| 10-inverted.png | `https://example.com/inverted` | 反色识别(tryInvert) |
| 11-colored-dot.png | `https://example.com/colored-dot` | 彩色圆点风格 |
| 12-tiny.png | `https://example.com/tiny` | 小尺寸码(约 70px) |
| logo-sample.png | (不识别) | 测试图,可作任意图片输入 |
