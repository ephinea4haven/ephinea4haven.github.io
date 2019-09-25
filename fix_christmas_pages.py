#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复圣诞页面中的转义问题
"""

import os
import re

# 圣诞页面文件列表
CHRISTMAS_PAGES = [
    'event/christmas2015.html',
    'event/christmas2016.html',
    'event/christmas2017.html',
    'event/christmas2018.html',
    'event/christmas2019.html',
    'event/christmas2020.html',
    'event/christmas2021.html',
    'event/christmas2022.html',
    'event/christmas2023.html',
    'event/christmas2024.html',
    'event/christmas2025.html',
]


def fix_html_file(file_path):
    """修复单个 HTML 文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        original_content = content

        # 1. 修复被转义的 span 标签
        # &lt;span style=&quot;color:red&quot;&gt; -> <span style="color:red">
        content = re.sub(
            r'&lt;span style=&quot;color:red&quot;&gt;(.*?)&lt;/span&gt;',
            r'<span style="color:red">\1</span>',
            content
        )

        # 2. 修复被转义的其他常见颜色
        content = re.sub(
            r'&lt;span style=&quot;color:(.*?)&quot;&gt;(.*?)&lt;/span&gt;',
            r'<span style="color:\1">\2</span>',
            content
        )

        # 3. 修复方括号转义
        # \[ -> [
        # \] -> ]
        content = content.replace(r'\[', '[')
        content = content.replace(r'\]', ']')

        # 4. 修复其他可能的 HTML 标签转义
        # &lt;br&gt; -> <br>
        content = content.replace('&lt;br&gt;', '<br>')
        content = content.replace('&lt;br/&gt;', '<br>')
        content = content.replace('&lt;br /&gt;', '<br>')

        # 只有内容发生变化时才写入
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✓ 已修复: {file_path}")
            return True
        else:
            print(f"○ 无需修复: {file_path}")
            return False

    except Exception as e:
        print(f"✗ 修复失败 {file_path}: {e}")
        return False


def main():
    """主函数"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    fixed_count = 0
    skipped_count = 0
    failed_count = 0

    print("开始修复圣诞页面...\n")

    for page in CHRISTMAS_PAGES:
        file_path = os.path.join(base_dir, page)
        if os.path.exists(file_path):
            result = fix_html_file(file_path)
            if result:
                fixed_count += 1
            else:
                skipped_count += 1
        else:
            print(f"✗ 文件不存在: {file_path}")
            failed_count += 1

    print(f"\n修复完成！已修复: {fixed_count}, 跳过: {skipped_count}, 失败: {failed_count}")


if __name__ == '__main__':
    main()
