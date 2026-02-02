#!/bin/bash
# 登录 GitHub 并推送代码

cd /opt/file-storage

echo "请提供 GitHub 凭证进行推送"
echo "如果是使用 Personal Access Token，请将 Token 作为密码"

# 尝试推送（会提示输入用户名和密码）
git push -u origin main

echo ""
echo "如果推送成功，请访问 https://github.com/openwangpan/wangpan 查看仓库"
echo ""
