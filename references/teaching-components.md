# 讲解组件与语义事件

用于“画面单调、希望多一些组件和元素”的反馈。原有粗像素、低对比背景、独立大小人物与局部暖光继续保留。增加的是内容动作与反馈，不是更精细的纹理。

## 可复用组件

文件：`assets/cinematic-template/components.mjs`。函数均接收 Canvas context 与一个参数对象，坐标为原生 1920×1080；值、状态、标签和透明度由该期时间轴决定。

| 组件 | 主要参数 | 何时用 |
|---|---|---|
| `drawPaper` | x / y / w / h / mark / alpha | 内容卡进入、移出、被标记 |
| `drawInventory` | x / y / w / count / title / state / alpha | 收藏、装备、资源、学习库存 |
| `drawRecallPanel` | x / y / w / title / state / alpha | 查询、检索、缺失结果；state 为 empty / failed / success |
| `drawOpenBook` | x / y / w / h / closed / mark | 看资料、合上资料、闭卷、卡点 |
| `drawQuizBoard` | x / y / w / prompt / answer / reference / reveal / correct / mark / alpha | 问题、尝试回答、展开参考答案、对照与修正 |
| `drawMarkerFlag` | x / y / label / alpha | 错误、路上的卡点、待练项目 |
| `drawFeedback` | x / y / w / progress / state / alpha | 即时对错、经验变化；correct 与 pending 两种状态 |
| `drawRewardBadge` | x / y / label / alpha | 获得能力、通过验证、解锁道具 |

这些都是世界里的独立道具或游戏 HUD，不是完整页面截图。组件标签从当前 episode 数据传入，不能把某期口播、音色或语速作为库默认。

## 原生场景中的增强分支

`scene.mjs` 保留原先的简单镜头。当 `episode.visualBeats` 存在时启用增强镜头，事件字段以整条时间轴的毫秒为单位：

```json
{
  "visualBeats": {
    "collectAt": 500,
    "queryAt": 2000,
    "contrastAt": 4500,
    "retrieveAt": 7000,
    "testAt": 11000,
    "closeAt": 11000,
    "markAt": 13500,
    "checkAt": 14500,
    "correctAt": 16500,
    "rewardAt": 17300,
    "unlockAt": 18200,
    "walkAt": 15400
  },
  "componentLabels": {
    "inventoryTitle": "物品栏",
    "queryTitle": "查询",
    "contrast": "库存与能力",
    "taskTitle": "当前任务",
    "prompt": "本次问题",
    "wrongAnswer": "尝试回答",
    "rightAnswer": "参考答案",
    "reward": "能力已解锁"
  }
}
```

这是接口示例，不是每个主题的固定故事模板。事件时点从本次实际口播中选择；不用的组件不启用，或者为该主题修改增强场景。长片可以给各场景独立编排。

## 让“丰富”仍然清楚

1. 一拍一个因果变化。资料飞入时看库存，检索失败时看结果，核对时看回答与参考答案，成功后才给奖励。
2. 面板与角色行动分开编排。至少考虑角色初始站位、行走中经过的区域和终点；当前静帧没挡脸，不代表后续移动也安全。
3. 背景门先绘，角色和手持道具在中间，奖励与 HUD 最后绘；不能让开门的背景矩形把奖章抹掉。
4. 展开答案、计数、旗帜、进度、打勾等有不同信息作用。不要把多个同义文本框堆满画面。
5. 入场、出场、状态切换与打字相位全部由场景时间计算，保持同帧重截一致。字体预载包含组件固定字形 `componentGlyphs` 和当前标签。
6. 游戏演示数字应来自当前模拟状态，不暗示有真实研究统计依据。新的口播与音频只保存在对应视频项目。
