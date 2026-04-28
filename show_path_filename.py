import os


def print_files_and_contents(folder_path):
    # 确保文件夹存在
    if not os.path.isdir(folder_path):
        print(f"错误：'{folder_path}' 不是一个有效的文件夹")
        return

    # 遍历文件夹
    for filename in os.listdir(folder_path):
        file_path = os.path.join(folder_path, filename)
        # 只处理文件，跳过子文件夹
        if not os.path.isfile(file_path):
            continue
        # 跳过 CSV 文件
        dd = ["d.txt", ".gitignore", "D题.docx", 'show.py', 'requirements.txt', 'readme.md', '作业1-LLM应用的制作和部署.pdf']
        if filename.lower().endswith('.csv') or filename in dd:
            continue

        # 输出文件路径
        print(f"文件：{file_path}")
        print()

        # 尝试以文本方式读取并输出内容
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                print(content)
        except UnicodeDecodeError:
            # 如果不是文本文件（如二进制），输出提示
            print("[无法以文本方式显示内容，可能是二进制文件]")
        except Exception as e:
            print(f"[读取文件时出错：{e}]")

        print("*" * 80)
        print()  # 额外空行分隔不同文件


if __name__ == "__main__":
    # 请将这里的路径修改为你需要查看的文件夹路径
    folder = r'D:\desktop\ChatRobot'
    print_files_and_contents(folder)
