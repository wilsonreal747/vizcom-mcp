# Vizcom MCP（非官方）

[English](README.md) | 简体中文

**让 AI Agent 参与 Vizcom 设计工作：草图渲染、多参考方案、局部修改和共享画板整理，全程不接管鼠标。**

由 [Wilson](https://github.com/wilsonreal747) 从设计师的日常工作需求出发开发。它是在本地运行的 stdio MCP，调用已认证的网页接口。当前是早期预览，尚未覆盖 Vizcom 全部功能；与 Vizcom 官方无隶属或背书关系。需要自己的合法账号与使用权限，生成会消耗账号额度，接口更新可能造成失效。

[能力与验证边界](docs/CAPABILITIES.md) · [路线图](docs/ROADMAP.md) · [参与贡献](CONTRIBUTING.md) · [MIT 许可证](LICENSE)

## 0.2.0 新增能力

资产图片与文件夹分范围读取、检索、详情；把底图预览存为明确版本的资产，并直接复用到图版，无需重复上传。新增说明便签、工作区改名/颜色、有序参考重连；图版读取补齐原始尺寸与缩放比例。共 **31 个工具、20 项离线测试**，新增非付费链路已于 2026-11-05 在独立测试图版回读验证。详见[资产与可视化推敲工作流](docs/ASSET-WORKFLOW.md)。不等于原生版本历史、高清分层导出或 3D/视频支持。

## 可以做什么

| 工作流 | 实际结果 |
| --- | --- |
| 草图到图片 | 上传草图、提交渲染、查询同一任务、下载结果 |
| 多参考探索 | 把有序参考图接到可编辑的原生提示词节点，一批生成 1–4 张 |
| 局部修改 | 提交蒙版编辑；发布时可恢复蒙版外全部原始像素，但仍需检查接缝 |
| 共享画板整理 | 创建分区、移动和等比缩放图片、检查出框与重叠、恢复已记录布局 |

原生提示词节点和输出图片会出现在设计师正在使用的 Vizcom 画板里；Studio 渲染／编辑需要显式发布回画板。当前没有实时订阅或原子协作锁。

**已验证的不只是画板整理。** 历史实跑包含草图上传→生成→下载、双参考双图批量、蒙版编辑／回放和布局恢复。证据来自一台 Windows；14 项离线测试只覆盖部分接口契约，不等于 21 个工具全部实跑或全部平台通过。尚无可公开的完整演示素材。

## 安装

**配套 Skill：**[vizcom-workbench](skills/vizcom-workbench/SKILL.md) 负责教 Agent 处理参考顺序、布局核验和失败恢复。将整个 `skills/vizcom-workbench` 文件夹放入所用 Agent 支持的 Skill 目录并加载；MCP 仍需按下文单独安装。详见[安装与维护检查](docs/SKILL-MAINTENANCE.md)。历史 v0.1.0 标签不含此 Skill，请使用包含该目录的最新源码并记录提交版本。

需要 Node.js 24 和 pnpm。当前只提供源码，不存在可直接 npx 安装的已发布 npm 包。

```sh
git clone https://github.com/wilsonreal747/vizcom-mcp.git
cd vizcom-mcp
pnpm install --frozen-lockfile --ignore-scripts
node --test
```

Windows 用户先正常登录自己 Edge Default 配置中的 Vizcom，再明确设置 `VIZCOM_SESSION_SOURCE=edge` 允许本地只读复用会话。令牌只留在进程中，不复制浏览器资料、不操作窗口。会话失效后正常登录并重启 MCP。`desktop` 会话方式尚未实跑验证。

也可由自己的秘密管理工具向进程注入 `VIZCOM_ACCESS_TOKEN`，此时不要设置 `VIZCOM_SESSION_SOURCE`。不要把令牌写到共享配置、Issue、聊天或仓库。

MCP 客户端配置示例，路径替换成实际绝对路径：

```json
{
  "mcpServers": {
    "vizcom": {
      "command": "node",
      "args": ["--use-system-ca", "C:/tools/vizcom-mcp/src/server.mjs"],
      "env": {
        "VIZCOM_SESSION_SOURCE": "edge",
        "VIZCOM_INPUT_ROOT": "C:/design/inputs",
        "VIZCOM_OUTPUT_ROOT": "C:/design/outputs"
      }
    }
  }
}
```

可选 `VIZCOM_ORGANIZATION_ID` 使用自己的工作区 ID。接入后依次验证 `tools/list`、`vizcom_status`、`vizcom_list_boards` 和授权画板读取。配置存在不代表当前 Agent 已加载。Coze 等云端环境不会因下载源码而自动获得本地 stdio 进程或 Edge 会话；远程接入尚未提供。

## 使用和恢复

- 草图：`vizcom_upload_sketch` → `vizcom_render_sketch` → 保存 promptId → `vizcom_get_result` → `vizcom_download_result`；`vizcom_publish_result` 将结果回放到画板。
- 参考图：`vizcom_create_prompt_node` → `vizcom_generate_board` → 保存 outputIds → `vizcom_read_board` 查询 → `vizcom_download_drawing`。@1、@2 对应实际输入顺序，显式说明各参考角色。
- 局部修改：同尺寸 PNG 原图和蒙版，白选黑保；`vizcom_edit_region` 后查询同一 promptId。恢复区域外像素不保证边缘自然或设计正确。
- 排版：修改前读取 updatedAt，保留恢复日志；修改后 `vizcom_check_layout`。x/y 是中心坐标，Y 向上；分区不会自动把图片收进去。不要用恢复功能覆盖后续人工修改。
- 批量接口默认数量 1，调用方可显式选 1–4；分辨率默认 2k。业务偏好由你的 Agent 指令决定，接口默认不等于用户偏好。`source` 分辨率选项不是独立的画幅／Original 控制。
- 超时不盲目重发生成请求，先按已知任务 ID 查询；部分 Studio 失败路径的持久恢复记录仍需增强。

## 边界与许可

未实现视频、3D、模型训练、完整图层编辑／导出、实时订阅、任务取消、配额管理或 HTTP 云端网关。没有逆向出数据库、模型权重或官方模型架构。画板下载取服务器预览图，不承诺分层或原始最高分辨率。

自有适配器代码采用 MIT，允许复用和商用并保留版权及许可声明；Vizcom 服务、商标、第三方依赖和用户图片不因此获得授权。当前 main 分支已加入许可，最初 v0.1.0 标签是许可加入前的历史版本。
