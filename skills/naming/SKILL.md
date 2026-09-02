---
name: naming
description: 根据中文描述生成英文标识符（PascalCase）。当用户提到"命名"、"起名"、"叫啥"、"取个名"、"这个叫啥"、"module/component/class/file 叫什么"等需要为代码元素起英文名的场景时使用，即使用户没有明确说"生成英文文件名"。
---

# 标识符命名助手

根据用户的中文描述，生成简洁、准确的 PascalCase 英文标识符（适用于类名、组件名、工具函数名、文件名等）。

**输入格式**: 用户在 skill 名称后直接跟中文描述，如 `naming 用户配置`、`naming 获取订单列表的接口`。中文描述就是命名对象的全部信息，无需额外确认或追问。

## 核心规则

- **输出格式**: 仅返回推荐名称，使用 PascalCase，用反引号包裹
- **只返回一个**: 不给出多个候选，只给最优解
- **简洁优先**: 用最少的词汇表达核心含义，避免冗余
- **单数优先**: 如 `UserConfig` 而非 `UserConfigs`（除非确指多个）

## 命名原则

1. **准确**: 优先表达核心功能，不堆砌修饰词
2. **自然**: 符合英语表达习惯
3. **统一**: 同一项目中同类元素保持命名风格一致

## 避免的模式

- 不用冗余后缀: `UserConfigFile` ❌ → `UserConfig` ✅
- 不用中文拼音: `YongHuLiang` ❌ → `UserList` ✅
- 不缩写罕见词: `AuthValidationMiddleware` 偏长，优先 `AuthMiddleware` ✅

## 常用词汇速查

| 中文 | 英文 |
|------|------|
| 配置 | Config |
| 用户 | User |
| 列表 | List |
| 详情 | Detail |
| 创建 | Create |
| 更新/编辑 | Update |
| 删除 | Delete |
| 工具 | Util |
| 服务 | Service |
| 组件 | Component |
| 页面 | Page |
| 接口 | Api |
| 类型定义 | Types |
| 常量 | Constants |
| 存储 | Store |
| 路由 | Route |
| 中间件 | Middleware |
| 处理器 | Handler |
| 验证 | Validate |
| 格式化 | Format |
| 解析 | Parse |
| 转换 | Transform |
| 日志 | Logger |
| 错误 | Error |
| 仓库 | Repo |
| 控制器 | Controller |
| 认证 | Auth |

## 边界情况

| 场景 | 处理方式 |
|------|----------|
| 描述非常模糊（如"写个工具"） | 输出通用名如 `Util`，并在末尾简要说明需要更多上下文 |
| 描述过长 | 提取核心 1-2 个关键词，丢弃修饰语 |
| 需同时命名多个元素 | 输出一个，提示用户继续描述其他元素 |

## 示例

| 输入 | 输出 |
|------|------|
| "用户配置" | `UserConfig` |
| "获取订单列表的接口" | `OrderListApi` |
| "处理用户登录验证的中间件" | `AuthMiddleware` |
| "时间格式化工具" | `TimeFormatUtil` |
| "错误处理中间件" | `ErrorHandler` |
| "路由配置" | `RouteConfig` |
| "创建订单" | `CreateOrder` |
| "用户服务" | `UserService` |
| "日志工具" | `Logger` |
