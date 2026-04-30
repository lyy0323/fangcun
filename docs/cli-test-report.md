# fangcun CLI 测试报告

| 项目 | 值 |
|------|------|
| 运行时间 | 2026-04-30 22:00:56 UTC+8 |
| 总耗时 | 32.1s |
| 用例总数 | 45 |
| 通过 | 45 |
| 失败 | 0 |
| 通过率 | 100% |

---

## 测试结果

| # | 时间 | 耗时 | 状态 | 用例 | 命令 | 备注 |
|---|------|------|------|------|------|------|
| 1 | 22:00:56.621 | 71ms | PASS | help: 主命令 | `python3 cli.py -h` |  |
| 2 | 22:00:56.693 | 64ms | PASS | help: validate | `python3 cli.py validate -h` |  |
| 3 | 22:00:56.757 | 64ms | PASS | help: rules | `python3 cli.py rules -h` |  |
| 4 | 22:00:56.822 | 64ms | PASS | help: char | `python3 cli.py char -h` |  |
| 5 | 22:00:56.886 | 65ms | PASS | help: rhyme | `python3 cli.py rhyme -h` |  |
| 6 | 22:00:56.952 | 64ms | PASS | help: suggest | `python3 cli.py suggest -h` |  |
| 7 | 22:00:57.017 | 1113ms | PASS | validate: 五绝通过 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 8 | 22:00:58.131 | 802ms | PASS | validate: 五绝不通过 | `python3 cli.py validate --text 春眠不觉晓处处闻啼鸟夜来风雨声花落知多少 --genre Shi` |  |
| 9 | 22:00:58.933 | 697ms | PASS | validate: 词 (词林正韵) | `python3 cli.py validate --text 东风夜放花千树更吹落星如雨宝马雕车香满路凤箫声动玉壶光转一夜鱼龙舞蛾儿雪柳黄金缕笑语盈盈暗香去众里寻他千百度蓦然回首那人却在灯火阑珊处 --genre Ci --rhyme-book Cilinzhengyun` |  |
| 10 | 22:00:59.631 | 1026ms | PASS | validate: 字数不匹配 | `python3 cli.py validate --text 三个字 --genre Shi` |  |
| 11 | 22:01:00.658 | 716ms | PASS | validate: 指定规则名 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --rule 五绝仄起` |  |
| 12 | 22:01:01.375 | 971ms | PASS | validate: pretty 模式 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi --pretty` |  |
| 13 | 22:01:02.346 | 973ms | PASS | validate: tone_pattern 存在 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 14 | 22:01:03.321 | 875ms | PASS | validate: rhyme 结构完整 | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层楼 --genre Shi` |  |
| 15 | 22:01:04.196 | 63ms | PASS | validate: 缺少 --text | `python3 cli.py validate --genre Shi` |  |
| 16 | 22:01:04.259 | 63ms | PASS | validate: 无效 genre | `python3 cli.py validate --text 测试 --genre Invalid` |  |
| 17 | 22:01:04.323 | 947ms | PASS | rules: 诗规则 | `python3 cli.py rules --genre Shi` |  |
| 18 | 22:01:05.270 | 804ms | PASS | rules: 增强字段 (tone_pattern/sentence_length) | `python3 cli.py rules --genre Shi --search 五绝` |  |
| 19 | 22:01:06.075 | 656ms | PASS | rules: Ci 含 cipai 字段 | `python3 cli.py rules --genre Ci --search 沁园春` |  |
| 20 | 22:01:06.732 | 1735ms | PASS | rules: 词规则数量 | `python3 cli.py rules --genre Ci` |  |
| 21 | 22:01:08.474 | 681ms | PASS | rules: 搜索沁园春 | `python3 cli.py rules --genre Ci --search 沁园春` |  |
| 22 | 22:01:09.155 | 717ms | PASS | rules: 搜索无结果 | `python3 cli.py rules --genre Shi --search 不存在的词牌` |  |
| 23 | 22:01:09.872 | 816ms | PASS | char: 单字无 book | `python3 cli.py char --char 东` |  |
| 24 | 22:01:10.689 | 656ms | PASS | char: 单字带 book | `python3 cli.py char --char 东 --book Pingshuiyun` |  |
| 25 | 22:01:11.345 | 657ms | PASS | char: 多字批量 (batch API) | `python3 cli.py char --char 明月 --book Pingshuiyun` |  |
| 26 | 22:01:12.003 | 646ms | PASS | char: 4字批量 | `python3 cli.py char --char 大江东去 --book Pingshuiyun` |  |
| 27 | 22:01:12.649 | 672ms | PASS | char: 不存在的字 | `python3 cli.py char --char 鑫` |  |
| 28 | 22:01:13.322 | 836ms | PASS | char: 繁体字 (繁→简) | `python3 cli.py char --char 東 --book Pingshuiyun` |  |
| 29 | 22:01:14.159 | 740ms | PASS | rhyme: 一东 | `python3 cli.py rhyme --book Pingshuiyun --category 一东` |  |
| 30 | 22:01:14.900 | 984ms | PASS | rhyme: 带 include | `python3 cli.py rhyme --book Pingshuiyun --category 一东 --include neighbor` |  |
| 31 | 22:01:15.885 | 953ms | PASS | rhyme: 不存在的韵部 | `python3 cli.py rhyme --book Pingshuiyun --category 不存在` |  |
| 32 | 22:01:16.838 | 1029ms | PASS | suggest: pair 模式 | `python3 cli.py suggest --term 明月 --mode pair` |  |
| 33 | 22:01:17.868 | 1431ms | PASS | suggest: pair --with-tones (batch) | `python3 cli.py suggest --term 明月 --mode pair --with-tones` |  |
| 34 | 22:01:19.300 | 1221ms | PASS | suggest: head 模式 | `python3 cli.py suggest --term 春 --mode head --length 2` |  |
| 35 | 22:01:20.521 | 1444ms | PASS | suggest: tail 模式 | `python3 cli.py suggest --term 月 --mode tail --length 2 --tone P` |  |
| 36 | 22:01:21.966 | 962ms | PASS | suggest: tongwei 模式 | `python3 cli.py suggest --term 春 --mode tongwei` |  |
| 37 | 22:01:22.929 | 1180ms | PASS | suggest: 无结果的词 | `python3 cli.py suggest --term xyzabc --mode pair` |  |
| 38 | 22:01:24.109 | 67ms | PASS | free-rhyme: help | `python3 cli.py free-rhyme -h` |  |
| 39 | 22:01:24.177 | 743ms | PASS | free-rhyme: 古体诗 | `python3 cli.py free-rhyme --text 卖炭翁，伐薪烧炭南山中。满面尘灰烟火色，两鬓苍苍十指黑。` |  |
| 40 | 22:01:24.920 | 1235ms | PASS | free-rhyme: pretty 模式 | `python3 cli.py free-rhyme --text 床前明月光，疑是地上霜。举头望明月，低头思故乡。 --pretty` |  |
| 41 | 22:01:26.155 | 688ms | PASS | free-rhyme: merge-tones | `python3 cli.py free-rhyme --text 轻轻的我走了。正如我轻轻的来。 --rhyme-book Zhonghua_Tongyun --merge-tones` |  |
| 42 | 22:01:26.844 | 61ms | PASS | free-rhyme: 缺少 --text | `python3 cli.py free-rhyme` |  |
| 43 | 22:01:26.905 | 668ms | PASS | validate: 占位符 □ | `python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层□ --genre Shi` |  |
| 44 | 22:01:27.574 | 1037ms | PASS | validate: 带标点输入 | `python3 cli.py validate --text 白日依山尽，黄河入海流。欲穷千里目，更上一层楼。 --genre Shi` |  |
| 45 | 22:01:28.611 | 67ms | PASS | 缺少子命令 | `python3 cli.py ` |  |

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
[{"char_count": 56, "cipai": "Qilyu", "first_line_rhyme": true, "name": "七律平起首句入韵", "sentence_count": 8, "sentence_lengt
```

**18. rules: 增强字段 (tone_pattern/sentence_length)** (rc=0)
```
$ python3 cli.py rules --genre Shi --search 五绝
[{"char_count": 20, "cipai": "Wujue", "first_line_rhyme": true, "name": "五绝仄起首句入韵", "sentence_count": 4, "sentence_lengt
```

**19. rules: Ci 含 cipai 字段** (rc=0)
```
$ python3 cli.py rules --genre Ci --search 沁园春
[{"char_count": 105, "cipai": "花发沁园春", "first_line_rhyme": false, "name": "花发沁园春_钦谱_格一", "sentence_count": null, "senten
```

**20. rules: 词规则数量** (rc=0)
```
$ python3 cli.py rules --genre Ci
[{"char_count": 105, "cipai": "梦横塘", "first_line_rhyme": false, "name": "梦横塘_钦谱_格一", "sentence_count": null, "sentence_l
```

**21. rules: 搜索沁园春** (rc=0)
```
$ python3 cli.py rules --genre Ci --search 沁园春
[{"char_count": 105, "cipai": "花发沁园春", "first_line_rhyme": false, "name": "花发沁园春_钦谱_格一", "sentence_count": null, "senten
```

**22. rules: 搜索无结果** (rc=0)
```
$ python3 cli.py rules --genre Shi --search 不存在的词牌
[]
```

**23. char: 单字无 book** (rc=0)
```
$ python3 cli.py char --char 东
{"char": "东", "rhyme_categories": {"Cilinzhengyun": ["第1部_平", "第1部_平"], "Pingshuiyun": ["一东"], "Zhonghua_Tongyun": ["十五雍
```

**24. char: 单字带 book** (rc=0)
```
$ python3 cli.py char --char 东 --book Pingshuiyun
{"char": "东", "rhyme_categories": [{"name": "一东", "tone_type": "P"}], "tones": ["平"]}
```

**25. char: 多字批量 (batch API)** (rc=0)
```
$ python3 cli.py char --char 明月 --book Pingshuiyun
[{"char": "明", "tones": ["平"], "tone": "P", "rhymes": ["八庚"]}, {"char": "月", "tones": ["入"], "tone": "Z", "rhymes": ["六月
```

**26. char: 4字批量** (rc=0)
```
$ python3 cli.py char --char 大江东去 --book Pingshuiyun
[{"char": "大", "tones": ["去"], "tone": "Z", "rhymes": ["九泰", "二十一个"]}, {"char": "江", "tones": ["平"], "tone": "P", "rhyme
```

**27. char: 不存在的字** (rc=0)
```
$ python3 cli.py char --char 鑫
{"char": "鑫", "rhyme_categories": {"Cilinzhengyun": ["第1部_平", "第13部_平"], "Pingshuiyun": ["二冬", "十二侵"], "Zhonghua_Tongyun
```

**28. char: 繁体字 (繁→简)** (rc=0)
```
$ python3 cli.py char --char 東 --book Pingshuiyun
{"char": "東", "rhyme_categories": [{"name": "一东", "tone_type": "P"}], "tones": ["平"]}
```

**29. rhyme: 一东** (rc=0)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 一东
{"category_name": "一东", "characters": ["中", "总", "种", "同", "衕", "东", "梦", "红", "风", "冲", "通", "公", "空", "疯", "宫", "工", "
```

**30. rhyme: 带 include** (rc=0)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 一东 --include neighbor
{"primary": {"category_name": "一东", "characters": ["中", "总", "种", "同", "衕", "东", "梦", "红", "风", "冲", "通", "公", "空", "疯",
```

**31. rhyme: 不存在的韵部** (rc=2)
```
$ python3 cli.py rhyme --book Pingshuiyun --category 不存在
{"error": "韵部 '不存在' 不存在"}
```

**32. suggest: pair 模式** (rc=0)
```
$ python3 cli.py suggest --term 明月 --mode pair
[["白云", 176], ["清风", 94], ["青山", 71], ["西风", 54], ["浮云", 47], ["春风", 42], ["落花", 38], ["夕阳", 36], ["秋风", 35], ["故人", 22]
```

**33. suggest: pair --with-tones (batch)** (rc=0)
```
$ python3 cli.py suggest --term 明月 --mode pair --with-tones
[["白云", 176, "ZP"], ["清风", 94, "?P"], ["青山", 71, "PP"], ["西风", 54, "PP"], ["浮云", 47, "PP"], ["春风", 42, "PP"], ["落花", 38,
```

**34. suggest: head 模式** (rc=0)
```
$ python3 cli.py suggest --term 春 --mode head --length 2
[["春风", 4455], ["春来", 1407], ["春色", 950], ["春光", 801], ["春深", 529], ["春水", 524], ["春雨", 461], ["春归", 418], ["春到", 400], 
```

**35. suggest: tail 模式** (rc=0)
```
$ python3 cli.py suggest --term 月 --mode tail --length 2 --tone P
[["明月", 1001], ["三月", 350], ["秋月", 296], ["风月", 289], ["山月", 284], ["头月", 203], ["新月", 178], ["残月", 170], ["边月", 153], [
```

**36. suggest: tongwei 模式** (rc=0)
```
$ python3 cli.py suggest --term 春 --mode tongwei
[["风", 91], ["秋", 89], ["山", 82], ["天", 80], ["人", 77], ["云", 75], ["寒", 74], ["花", 71], ["香", 69], ["流", 69], ["江", 66]
```

**37. suggest: 无结果的词** (rc=0)
```
$ python3 cli.py suggest --term xyzabc --mode pair
[]
```

**38. free-rhyme: help** (rc=0)
```
$ python3 cli.py free-rhyme -h
usage: fangcun free-rhyme [-h] --text TEXT                           [--rhyme-book {Pingshuiyun,Cilinzhengyun,Zhonghua_T
```

**39. free-rhyme: 古体诗** (rc=0)
```
$ python3 cli.py free-rhyme --text 卖炭翁，伐薪烧炭南山中。满面尘灰烟火色，两鬓苍苍十指黑。
{"candidates": [{"categories": ["一东"], "char": "翁", "line": 0, "pos": 2}, {"categories": ["一东", "一送"], "char": "中", "lin
```

**40. free-rhyme: pretty 模式** (rc=0)
```
$ python3 cli.py free-rhyme --text 床前明月光，疑是地上霜。举头望明月，低头思故乡。 --pretty
韵脚候选 (4 个):   第1句 [光] 七阳   第1句 [霜] 七阳   第2句 [月] 六月   第2句 [乡] 七阳  押韵组 (1 组):   组1: 第1句 - 第1句 - 第2句
```

**41. free-rhyme: merge-tones** (rc=0)
```
$ python3 cli.py free-rhyme --text 轻轻的我走了。正如我轻轻的来。 --rhyme-book Zhonghua_Tongyun --merge-tones
{"candidates": [{"categories": ["三鹅_平", "九熬_仄"], "char": "了", "line": 0, "pos": 5}, {"categories": ["七哀_平"], "char": "来"
```

**42. free-rhyme: 缺少 --text** (rc=2)
```
$ python3 cli.py free-rhyme
(empty)
```

**43. validate: 占位符 □** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽黄河入海流欲穷千里目更上一层□ --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**44. validate: 带标点输入** (rc=0)
```
$ python3 cli.py validate --text 白日依山尽，黄河入海流。欲穷千里目，更上一层楼。 --genre Shi
{"is_valid": true, "rule": {"char_count": 20, "cipai": "Wujue", "genre": "Shi", "name": "五绝仄起"}, "chars": ["白", "日", "依"
```

**45. 缺少子命令** (rc=2)
```
$ python3 cli.py 
(empty)
```
