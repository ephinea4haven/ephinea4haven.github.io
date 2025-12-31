#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将 markdown 文件转换为统一风格的 HTML 文件
"""

import os
import re
import html

# 需要转换的文件列表 (相对路径，不含后缀)
MD_FILES = [
    # 基本信息
    'ephinea',
    'command',
    'ephinea_rules',
    'anguish',
    # 掉落表相关
    'en2chinese',
    # 任务相关
    'monsters',
    'gallons_roulette',
    'ep1ch',
    'ep2ch',
    'event/event',
    # 圣诞活动子页面
    'event/christmas2015',
    'event/christmas2016',
    'event/christmas2017',
    'event/christmas2018',
    'event/christmas2019',
    'event/christmas2020',
    'event/christmas2021',
    'event/christmas2022',
    'event/christmas2023',
    'event/christmas2024',
    'event/christmas2025',
    # 道具属性相关
    'drop_roll',
    'itempt',
    'weapon_nerf',
    'WSBoost',
    'partconvert',
    # 公式相关
    'equipment',
    'mechanics',
    'v50x',
    'aim',
    'survial_hp',
    'mag',
    # 客户端相关
    'errorcode',
    'register',
    'ime',
    'saveaccount',
    'localized',
    'crash',
    'timezone',
    'discord',
    'acronym',
]

# HTML 模板
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-CN">

<head>
    <meta charset='utf-8'>
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, maximum-scale=2">
    <title>{title} | Ephinea PSOBB</title>
    <style type="text/css">
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            display: flex;
            flex-direction: column;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            padding: 20px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f0f4ff url('static/img/background3.png') center center;
            background-size: cover;
            background-attachment: fixed;
            position: relative;
        }}

        body::before {{
            content: '';
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(255, 255, 255, 0.92);
            z-index: 0;
        }}

        body > * {{
            position: relative;
            z-index: 1;
        }}

        header {{
            margin-bottom: 25px;
            text-align: center;
            width: 100%;
        }}

        #project_title {{
            color: #1e3a8a;
            font-size: 2.8em;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(59, 130, 246, 0.2);
            margin-bottom: 15px;
            letter-spacing: 2px;
        }}

        .back-link {{
            display: inline-block;
            background: linear-gradient(135deg, #3b82f6, #8b5cf6);
            color: white;
            padding: 12px 30px;
            border-radius: 30px;
            text-decoration: none;
            font-size: 16px;
            font-weight: 600;
            box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
            transition: all 0.3s ease;
            margin-bottom: 25px;
        }}

        .back-link:hover {{
            transform: translateY(-3px);
            box-shadow: 0 6px 25px rgba(59, 130, 246, 0.4);
            background: linear-gradient(135deg, #2563eb, #7c3aed);
        }}

        .content-container {{
            max-width: 1200px;
            width: 100%;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(139, 92, 246, 0.2);
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
            line-height: 1.8;
        }}

        .content-container h1 {{
            color: #1e3a8a;
            font-size: 2.2em;
            font-weight: 700;
            margin-bottom: 20px;
            padding-bottom: 15px;
            border-bottom: 3px solid rgba(99, 102, 241, 0.3);
        }}

        .content-container h2 {{
            color: #6366f1;
            font-size: 1.8em;
            font-weight: 600;
            margin-top: 35px;
            margin-bottom: 18px;
            padding-bottom: 10px;
            border-bottom: 2px solid rgba(99, 102, 241, 0.2);
        }}

        .content-container h3 {{
            color: #8b5cf6;
            font-size: 1.4em;
            font-weight: 600;
            margin-top: 25px;
            margin-bottom: 15px;
        }}

        .content-container h4 {{
            color: #a78bfa;
            font-size: 1.2em;
            font-weight: 600;
            margin-top: 20px;
            margin-bottom: 12px;
        }}

        .content-container p {{
            color: #1f2937;
            margin-bottom: 15px;
            text-align: justify;
        }}

        .content-container ul, .content-container ol {{
            margin-left: 25px;
            margin-bottom: 15px;
            color: #1f2937;
        }}

        .content-container li {{
            margin-bottom: 8px;
            line-height: 1.6;
        }}

        .content-container a {{
            color: #6366f1;
            text-decoration: none;
            font-weight: 500;
            border-bottom: 1px solid transparent;
            transition: all 0.2s ease;
        }}

        .content-container a:hover {{
            color: #4f46e5;
            border-bottom-color: #6366f1;
        }}

        .content-container table {{
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }}

        .content-container table thead {{
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
        }}

        .content-container table th {{
            padding: 12px 15px;
            text-align: left;
            font-weight: 600;
        }}

        .content-container table td {{
            padding: 12px 15px;
            border-bottom: 1px solid rgba(99, 102, 241, 0.1);
        }}

        .content-container table tr:hover {{
            background: rgba(99, 102, 241, 0.05);
        }}

        .content-container code {{
            background: rgba(99, 102, 241, 0.1);
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #4f46e5;
            font-size: 0.9em;
        }}

        .content-container pre {{
            background: rgba(99, 102, 241, 0.1);
            padding: 15px;
            border-radius: 8px;
            overflow-x: auto;
            margin-bottom: 15px;
        }}

        .content-container pre code {{
            background: none;
            padding: 0;
        }}

        .content-container blockquote {{
            border-left: 4px solid #6366f1;
            padding-left: 20px;
            margin: 20px 0;
            color: #4b5563;
            font-style: italic;
        }}

        .content-container hr {{
            border: none;
            border-top: 2px solid rgba(99, 102, 241, 0.2);
            margin: 30px 0;
        }}

        .content-container strong {{
            color: #1e3a8a;
            font-weight: 600;
        }}

        @media (max-width: 768px) {{
            #project_title {{
                font-size: 2em;
            }}

            .content-container {{
                padding: 25px;
            }}

            body {{
                padding: 15px;
            }}
        }}
    </style>
</head>

<body>
    <header>
        <h1 id="project_title">{title}</h1>
    </header>

    <a href="/index.html" class="back-link">← 返回首页</a>

    <div class="content-container">
        {content}
    </div>
</body>

</html>
'''


def simple_md_to_html(md_text):
    """简单的 markdown 转 HTML（不依赖第三方库）"""
    lines = md_text.split('\n')
    html_lines = []
    in_list = False
    in_code = False
    in_table = False
    table_lines = []

    i = 0
    while i < len(lines):
        line = lines[i]

        # 代码块处理
        if line.strip().startswith('```'):
            if not in_code:
                in_code = True
                html_lines.append('<pre><code>')
            else:
                in_code = False
                html_lines.append('</code></pre>')
            i += 1
            continue

        if in_code:
            import html as html_module
            html_lines.append(html_module.escape(line))
            i += 1
            continue

        # 标题处理
        if line.startswith('#') and not line.startswith('#!'):
            level = len(re.match(r'^#+', line).group())
            text = line[level:].strip()
            import html as html_module
            html_lines.append(f'<h{level}>{html_module.escape(text)}</h{level}>')
            i += 1
            continue

        # 表格处理
        if '|' in line and line.strip().startswith('|'):
            if not in_table:
                in_table = True
                table_lines = [line]
            else:
                table_lines.append(line)
            i += 1
            # 检查下一行是否还是表格
            if i >= len(lines) or not (lines[i].strip().startswith('|') or lines[i].strip().startswith('-')):
                # 表格结束，转换表格
                html_lines.append(convert_table(table_lines))
                in_table = False
                table_lines = []
            continue

        # 无序列表处理
        if line.strip().startswith('* ') or line.strip().startswith('- '):
            if not in_list:
                html_lines.append('<ul>')
                in_list = 'ul'
            text = line.strip()[2:]
            html_lines.append(f'<li>{process_inline(text)}</li>')
            i += 1
            # 检查下一行
            if i >= len(lines) or not (lines[i].strip().startswith('* ') or lines[i].strip().startswith('- ')):
                html_lines.append('</ul>')
                in_list = False
            continue

        # 分隔线
        if re.match(r'^[-*_]{3,}$', line.strip()):
            html_lines.append('<hr>')
            i += 1
            continue

        # 空行
        if not line.strip():
            if in_list:
                html_lines.append('</ul>')
                in_list = False
            html_lines.append('')
            i += 1
            continue

        # 普通段落
        html_lines.append(f'<p>{process_inline(line)}</p>')
        i += 1

    return '\n'.join(html_lines)


def convert_table(table_lines):
    """转换 markdown 表格为 HTML"""
    if len(table_lines) < 2:
        return ''

    result = ['<table>']

    # 处理表头
    header_cells = [cell.strip() for cell in table_lines[0].split('|')[1:-1]]
    result.append('<thead><tr>')
    for cell in header_cells:
        import html as html_module
        result.append(f'<th>{html_module.escape(cell)}</th>')
    result.append('</tr></thead>')

    # 处理表体
    result.append('<tbody>')
    for line in table_lines[2:]:  # 跳过分隔线
        if not line.strip():
            continue
        cells = [cell.strip() for cell in line.split('|')[1:-1]]
        result.append('<tr>')
        for cell in cells:
            result.append(f'<td>{process_inline(cell)}</td>')
        result.append('</tr>')
    result.append('</tbody>')

    result.append('</table>')
    return '\n'.join(result)


def process_inline(text):
    """处理行内 markdown 语法"""
    # 图片（需要最先处理，避免被其他规则干扰）
    def fix_image_path(match):
        alt = match.group(1)
        path = match.group(2)
        # 修正相对路径为绝对路径
        if path.startswith('./'):
            path = '/' + path[2:]
        return f'<img src="{path}" alt="{alt}" style="max-width: 100%; height: auto; margin: 10px 0;">'

    text = re.sub(r'!\[(.+?)\]\((.+?)\)', fix_image_path, text)

    # 链接
    text = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', text)

    # 粗体
    text = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', text)
    text = re.sub(r'__(.+?)__', r'<strong>\1</strong>', text)

    # 斜体（避免与粗体冲突）
    text = re.sub(r'(?<!\*)\*([^*]+?)\*(?!\*)', r'<em>\1</em>', text)
    # 斜体下划线语法已移除，避免与文件名中的下划线冲突

    # 代码
    text = re.sub(r'`(.+?)`', r'<code>\1</code>', text)

    # 删除线
    text = re.sub(r'~~(.+?)~~', r'<del>\1</del>', text)

    # 换行
    text = text.replace('<br/>', '<br>')

    return text


def read_md_title(md_path):
    """从 markdown 文件中读取标题"""
    try:
        with open(md_path, 'r', encoding='utf-8') as f:
            content = f.read()
            # 查找第一个一级标题
            match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
            if match:
                return match.group(1).strip()
            # 如果没有一级标题，返回文件名
            return os.path.splitext(os.path.basename(md_path))[0]
    except Exception as e:
        print(f"读取标题失败 {md_path}: {e}")
        return os.path.splitext(os.path.basename(md_path))[0]


def convert_md_to_html(md_path, html_path):
    """将单个 markdown 文件转换为 HTML"""
    try:
        # 读取 markdown 文件
        with open(md_path, 'r', encoding='utf-8') as f:
            md_content = f.read()

        # 获取标题
        title = read_md_title(md_path)

        # 转换 markdown 为 HTML
        html_content = simple_md_to_html(md_content)

        # 使用模板生成完整的 HTML
        template = HTML_TEMPLATE

        # 如果文件在子目录中，需要调整背景图片和返回首页的路径
        base_dir = os.path.dirname(os.path.abspath(__file__))
        rel_path = os.path.relpath(html_path, base_dir)
        depth = rel_path.count(os.sep)

        if depth > 0:
            # 在子目录中，需要使用相对路径
            bg_path = '../' * depth + 'static/img/background3.png'
            home_path = '../' * depth + 'index.html'
            template = template.replace("url('static/img/background3.png')", f"url('{bg_path}')")
            template = template.replace('href="/index.html"', f'href="{home_path}"')

        full_html = template.format(
            title=title,
            content=html_content
        )

        # 写入 HTML 文件
        os.makedirs(os.path.dirname(html_path) if os.path.dirname(html_path) else '.', exist_ok=True)
        with open(html_path, 'w', encoding='utf-8') as f:
            f.write(full_html)

        print(f"✓ 已转换: {md_path} -> {html_path}")
        return True
    except Exception as e:
        print(f"✗ 转换失败 {md_path}: {e}")
        return False


def main():
    """主函数"""
    base_dir = os.path.dirname(os.path.abspath(__file__))
    success_count = 0
    fail_count = 0

    print("开始批量转换 Markdown 文件为 HTML...\n")

    for file_path in MD_FILES:
        md_path = os.path.join(base_dir, f"{file_path}.md")
        html_path = os.path.join(base_dir, f"{file_path}.html")

        if os.path.exists(md_path):
            if convert_md_to_html(md_path, html_path):
                success_count += 1
            else:
                fail_count += 1
        else:
            print(f"✗ 文件不存在: {md_path}")
            fail_count += 1

    print(f"\n转换完成！成功: {success_count}, 失败: {fail_count}")


if __name__ == '__main__':
    main()
