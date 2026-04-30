# fangcun CLI 测试报告

| 项目 | 值 |
|------|------|
| 运行时间 | 2026-04-30 17:46:37 UTC+8 |
| 总耗时 | 27.4s |
| 用例总数 | 41 |
| 通过 | 41 |
| 失败 | 0 |
| 通过率 | 100% |

---

## 测试结果

| # | 时间 | 耗时 | 状态 | 用例 | 命令 | 备注 |
|---|------|------|------|------|------|------|
| 1 | 17:46:37.910 | 126ms | PASS | help: 主命令 | `python3 cli.py -h` |  |
| 2 | 17:46:38.036 | 94ms | PASS | help: validate | `python3 cli.py validate -h` |  |
| 3 | 17:46:38.131 | 92ms | PASS | help: rules | `python3 cli.py rules -h` |  |
| 4 | 17:46:38.223 | 106ms | PASS | help: char | `python3 cli.py char -h` |  |
| 5 | 17:46:38.330 | 112ms | PASS | help: rhyme | `python3 cli.py rhyme -h` |  |
| 6 | 17:46:38.443 | 102ms | PASS | help: suggest | `python3 cli.py suggest -h` |  |
| 7 | 17:46:38.546 | 787ms | PASS | validate: 五绝通过 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 8 | 17:46:39.334 | 584ms | PASS | validate: 五绝不通过 | `python3 cli.py validate --text 春眠不觉晓处处闻啼鸟夜来风雨声花落知多少 --genre Shi` |  |
| 9 | 17:46:39.919 | 569ms | PASS | validate: 词 (词林正韵) | `python3 cli.py validate --text 东风夜放花千树更吹落星如雨宝马雕车香满路凤箫声动玉壶光转一夜鱼龙舞蛾儿雪柳黄金缕笑语盈盈暗香去众里寻他千百度蓦然回首那人却在灯火阑珊处 --genre Ci --rhyme-book Cilinzhengyun` |  |
| 10 | 17:46:40.488 | 581ms | PASS | validate: 字数不匹配 | `python3 cli.py validate --text 三个字 --genre Shi` |  |
| 11 | 17:46:41.071 | 569ms | PASS | validate: 指定规则名 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --rule 五绝仄起` |  |
| 12 | 17:46:41.640 | 607ms | PASS | validate: pretty 模式 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --pretty` |  |
| 13 | 17:46:42.248 | 660ms | PASS | validate: tone_pattern 存在 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 14 | 17:46:42.908 | 643ms | PASS | validate: rhyme 结构完整 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 15 | 17:46:43.552 | 71ms | PASS | validate: 缺少 --text | `python3 cli.py validate --genre Shi` |  |
| 16 | 17:46:43.624 | 68ms | PASS | validate: 无效 genre | `python3 cli.py validate --text 测试 --genre Invalid` |  |
| 17 | 17:46:43.692 | 1333ms | PASS | rules: 诗规则 | `python3 cli.py rules --genre Shi` |  |
| 18 | 17:46:45.026 | 722ms | PASS | rules: 词规则数量 | `python3 cli.py rules --genre Ci` |  |
| 19 | 17:46:45.751 | 563ms | PASS | rules: 搜索沁园春 | `python3 cli.py rules --genre Ci --search 沁园春` |  |
| 20 | 17:46:46.314 | 573ms | PASS | rules: 搜索无结果 | `python3 cli.py rules --genre Shi --search 不存在的词牌` |  |
| 21 | 17:46:46.888 | 1210ms | PASS | char: 单字无 book | `python3 cli.py char --char 东` |  |
| 22 | 17:46:48.098 | 571ms | PASS | char: 单字带 book | `python3 cli.py char --char 东 --book Pingshuiyun` |  |
| 23 | 17:46:48.670 | 581ms | PASS | char: 多字批量 | `python3 cli.py char --char 明月 --book Pingshuiyun` |  |
| 24 | 17:46:49.252 | 578ms | PASS | char: 不存在的字 | `python3 cli.py char --char 鑫` |  |
| 25 | 17:46:49.831 | 1389ms | PASS | char: 繁体字 (繁→简) | `python3 cli.py char --char 東 --book Pingshuiyun` |  |
| 26 | 17:46:51.220 | 602ms | PASS | rhyme: 一东 | `python3 cli.py rhyme --book Pingshuiyun --category 一东` |  |
| 27 | 17:46:51.823 | 601ms | PASS | rhyme: 带 include | `python3 cli.py rhyme --book Pingshuiyun --category 一东 --include neighbor` |  |
| 28 | 17:46:52.424 | 560ms | PASS | rhyme: 不存在的韵部 | `python3 cli.py rhyme --book Pingshuiyun --category 不存在` |  |
| 29 | 17:46:52.985 | 3444ms | PASS | suggest: pair 模式 | `python3 cli.py suggest --term 明月 --mode pair` |  |
| 30 | 17:46:56.430 | 1241ms | PASS | suggest: head 模式 | `python3 cli.py suggest --term 春 --mode head --length 2` |  |
| 31 | 17:46:57.672 | 1098ms | PASS | suggest: tail 模式 | `python3 cli.py suggest --term 月 --mode tail --length 2 --tone P` |  |
| 32 | 17:46:58.771 | 1629ms | PASS | suggest: tongwei 模式 | `python3 cli.py suggest --term 春 --mode tongwei` |  |
| 33 | 17:47:00.401 | 736ms | PASS | suggest: 无结果的词 | `python3 cli.py suggest --term xyzabc --mode pair` |  |
| 34 | 17:47:01.137 | 65ms | PASS | free-rhyme: help | `python3 cli.py free-rhyme -h` |  |
| 35 | 17:47:01.203 | 610ms | PASS | free-rhyme: 古体诗 | `python3 cli.py free-rhyme --text 卖炭翁，伐薪烧炭南山中。满面尘灰烟火色，两鬓苍苍十指黑。` |  |
| 36 | 17:47:01.814 | 1597ms | PASS | free-rhyme: pretty 模式 | `python3 cli.py free-rhyme --text 床前明月光，疑是地上霜。举头望明月，低头思故乡。 --pretty` |  |
| 37 | 17:47:03.412 | 581ms | PASS | free-rhyme: merge-tones | `python3 cli.py free-rhyme --text 轻轻的我走了。正如我轻轻的来。 --rhyme-book Zhonghua_Tongyun --merge-tones` |  |
| 38 | 17:47:03.994 | 71ms | PASS | free-rhyme: 缺少 --text | `python3 cli.py free-rhyme` |  |
| 39 | 17:47:04.065 | 562ms | PASS | validate: 占位符 □ | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层□ --genre Shi` |  |
| 40 | 17:47:04.627 | 572ms | PASS | validate: 带标点输入 | `python3 cli.py validate --text 白日依山尽，黄河入海流。欲穷千里目，更上一层楼。 --genre Shi` |  |
| 41 | 17:47:05.200 | 72ms | PASS | 缺少子命令 | `python3 cli.py ` |  |

---

## 输出摘要

**1. help: 主命令** (rc=0)
```
$ python3 cli.py -h
usage: fangcun [-h] {validate,rules,char,rhyme,suggest,free-rhyme} ...  方寸 — 格律诗词校验工具 (Chinese classical poetry validato
```

**2. help: validate** (rc=0)
```
$ python3 cli.py validate -h
usage: fangcun validate [-h] --text TEXT --genre {Shi,Ci}                         [--rhyme-book {Pingshuiyun,Cilinzhengy
```

**3. help: rules** (rc=0)
```
$ python3 cli.py rules -h
usage: fangcun rules [-h] --genre {Shi,Ci} [--search SEARCH]  options:   -h, --help        show this help message and ex
```

**4. help: char** (rc=0)
```
$ python3 cli.py char -h
usage: fangcun char [-h] --char CHAR [--book BOOK]  options:   -h, --help   show this help message and exit   --char CHA
```

**5. help: rhyme** (rc=0)
```
$ python3 cli.py rhyme -h
usage: fangcun rhyme [-h] --book {Pingshuiyun,Cilinzhengyun,Zhonghua_Tongyun}                      --category CATEGORY [
```

**6. help: suggest** (rc=0)
```
$ python3 cli.py suggest -h
usage: fangcun suggest [-h] --term TERM --mode {head,tail,pair,tongwei}                        [--length LENGTH] [--tone
```

**7. validate: 五绝通过** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**8. validate: 五绝不通过** (rc=1)
```
$ python3 cli.py validate --text 春眠不觉晓处处闻啼鸟夜来风雨声花落知多少 --genre Shi
{"is_valid": false, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["春", "眠", "不
```

**9. validate: 词 (词林正韵)** (rc=1)
```
$ python3 cli.py validate --text 东风夜放花千树更吹落星如雨宝马雕车香满路凤箫声动玉壶光转一夜鱼龙舞蛾儿雪柳黄金缕笑语盈盈暗香去众里寻他千百度蓦然回首那人却在灯火阑珊处 --genre Ci --rhyme-book Cilinzhengyun
{"is_valid": false, "rule": {"char_count": 67, "cipai": "青玉案", "genre": "Ci", "name": "青玉案_钦谱_格一"}, "chars": ["东", "风", 
```

**10. validate: 字数不匹配** (rc=1)
```
$ python3 cli.py validate --text 三个字 --genre Shi
{"is_valid": false, "rule": null, "chars": ["三", "个", "字"], "tone_pattern": [], "rhyme": {"name": null, "positions": nul
```

**11. validate: 指定规则名** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --rule 五绝仄起
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**12. validate: pretty 模式** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --pretty
============================================================ 体裁: 五绝仄起 押韵: 十一尤 结果: 通过  白日依山尽黄河入海流　 中仄中平仄平平中仄平[92m韵[0m  
```

**13. validate: tone_pattern 存在** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**14. validate: rhyme 结构完整** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**15. validate: 缺少 --text** (rc=2)
```
$ python3 cli.py validate --genre Shi
(empty)
```

**16. validate: 无效 genre** (rc=2)
```
$ python3 cli.py validate --text 测试 --genre Invalid
(empty)
```

**17. rules: 诗规则** (rc=0)
```
$ python3 cli.py rules --genre Shi
[{"char_count": 56, "name": "七律平起首句入韵"}, {"char_count": 56, "name": "七律平起"}, {"char_count": 56, "name": "七律仄起"}, {"char_
```

**18. rules: 词规则数量** (rc=0)
```
$ python3 cli.py rules --genre Ci
[{"char_count": 105, "name": "梦横塘_钦谱_格一"}, {"char_count": 103, "name": "望南云慢_钦谱_格一"}, {"char_count": 72, "name": "于飞乐_钦谱
```

**19. rules: 搜索沁园春** (rc=0)
```
$ python3 cli.py rules --genre Ci --search 沁园春
[{"char_count": 105, "name": "花发沁园春_钦谱_格一"}, {"char_count": 105, "name": "花发沁园春_钦谱_格二"}, {"char_count": 114, "name": "沁园
```

**20. rules: 搜索无结果** (rc=0)
```
$ python3 cli.py rules --genre Shi --search 不存在的词牌
[]
```

**21. char: 单字无 book** (rc=0)
```
$ python3 cli.py char --char 东
{"char": "东", "rhyme_categories": {"Cilinzhengyun": ["第1部_平", "第1部_平"], "Pingshuiyun": ["一东"], "Zhonghua_Tongyun": ["十五雍
```

**22. char: 单字带 book** (rc=0)
```
$ python3 cli.py char --char 东 --book Pingshuiyun
{"char": "东", "rhyme_categories": [{"name": "一东", "tone_type": "P"}], "tones": ["平"]}
```

**23. char: 多字批量** (rc=0)
```
$ python3 cli.py char --char 明月 --book Pingshuiyun
[{"char": "明", "tones": ["平"], "tone": "P", "rhymes": ["八庚"]}, {"char": "月", "tones": ["入"], "tone": "Z", "rhymes": ["六月
```

**24. char: 不存在的字** (rc=0)
```
$ python3 cli.py char --char 鑫
{"char": "鑫", "rhyme_categories": {"Cilinzhengyun": ["第1部_平", "第13部_平"], "Pingshuiyun": ["二冬", "十二侵"], "Zhonghua_Tongyun
```

**25. char: 繁体字 (繁→简)** (rc=0)
```
$ python3 cli.py char --char 東 --book Pingshuiyun
{"char": "東", "rhyme_categories": [{"name": "一东", "tone_type": "P"}], "tones": ["平"]}
```

**26. rhyme: 一东** (rc=0)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 一东
{"category_name": "一东", "characters": ["中", "总", "种", "同", "衕", "东", "梦", "红", "风", "冲", "通", "公", "空", "疯", "宫", "工", "
```

**27. rhyme: 带 include** (rc=0)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 一东 --include neighbor
{"primary": {"category_name": "一东", "characters": ["中", "总", "种", "同", "衕", "东", "梦", "红", "风", "冲", "通", "公", "空", "疯",
```

**28. rhyme: 不存在的韵部** (rc=2)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 不存在
{"error": "韵部 '不存在' 不存在"}
```

**29. suggest: pair 模式** (rc=0)
```
$ python3 cli.py suggest --term 明月 --mode pair
[["白云", 176], ["清风", 94], ["青山", 71], ["西风", 54], ["浮云", 47], ["春风", 42], ["落花", 38], ["夕阳", 36], ["秋风", 35], ["故人", 22]
```

**30. suggest: head 模式** (rc=0)
```
$ python3 cli.py suggest --term 春 --mode head --length 2
[["春风", 4455], ["春来", 1407], ["春色", 950], ["春光", 801], ["春深", 529], ["春水", 524], ["春雨", 461], ["春归", 418], ["春到", 400], 
```

**31. suggest: tail 模式** (rc=0)
```
$ python3 cli.py suggest --term 月 --mode tail --length 2 --tone P
[["明月", 1001], ["三月", 350], ["秋月", 296], ["风月", 289], ["山月", 284], ["头月", 203], ["新月", 178], ["残月", 170], ["边月", 153], [
```

**32. suggest: tongwei 模式** (rc=0)
```
$ python3 cli.py suggest --term 春 --mode tongwei
[["风", 91], ["秋", 89], ["山", 82], ["天", 80], ["人", 77], ["云", 75], ["寒", 74], ["花", 71], ["香", 69], ["流", 69], ["江", 66]
```

**33. suggest: 无结果的词** (rc=0)
```
$ python3 cli.py suggest --term xyzabc --mode pair
[]
```

**34. free-rhyme: help** (rc=0)
```
$ python3 cli.py free-rhyme -h
usage: fangcun free-rhyme [-h] --text TEXT                           [--rhyme-book {Pingshuiyun,Cilinzhengyun,Zhonghua_T
```

**35. free-rhyme: 古体诗** (rc=0)
```
$ python3 cli.py free-rhyme --text 卖炭翁，伐薪烧炭南山中。满面尘灰烟火色，两鬓苍苍十指黑。
{"candidates": [{"categories": ["一东"], "char": "翁", "line": 0, "pos": 2}, {"categories": ["一东", "一送"], "char": "中", "lin
```

**36. free-rhyme: pretty 模式** (rc=0)
```
$ python3 cli.py free-rhyme --text 床前明月光，疑是地上霜。举头望明月，低头思故乡。 --pretty
韵脚候选 (4 个):   第1句 [光] 七阳   第1句 [霜] 七阳   第2句 [月] 六月   第2句 [乡] 七阳  押韵组 (1 组):   组1: 第1句 - 第1句 - 第2句
```

**37. free-rhyme: merge-tones** (rc=0)
```
$ python3 cli.py free-rhyme --text 轻轻的我走了。正如我轻轻的来。 --rhyme-book Zhonghua_Tongyun --merge-tones
{"candidates": [{"categories": ["三鹅_平", "九熬_仄"], "char": "了", "line": 0, "pos": 5}, {"categories": ["七哀_平"], "char": "来"
```

**38. free-rhyme: 缺少 --text** (rc=2)
```
$ python3 cli.py free-rhyme
(empty)
```

**39. validate: 占位符 □** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层□ --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**40. validate: 带标点输入** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽，黄河入海流。欲穷千里目，更上一层楼。 --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**41. 缺少子命令** (rc=2)
```
$ python3 cli.py 
(empty)
```
