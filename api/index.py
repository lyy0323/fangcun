"""Vercel Serverless Function 入口"""
import sys
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
os.chdir(ROOT)

from app import app

# 保留顶层引用供 Vercel 发现
application = app
