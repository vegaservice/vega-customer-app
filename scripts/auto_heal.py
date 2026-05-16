#!/usr/bin/env python3
"""
VEGA Auto-Healer
When a build fails: reads logs -> Claude AI analyzes -> fixes code -> redeploys.
Zero human involvement.
"""

import os
import sys
import json
import zipfile
import io
import base64
import requests
import anthropic

GITHUB_TOKEN = os.environ['GITHUB_TOKEN']
ANTHROPIC_API_KEY = os.environ['ANTHROPIC_API_KEY']
REPO_OWNER = 'vegaservice'
REPO_NAME = 'vega-customer-app'
BRANCH = 'main'
RUN_ID = os.environ.get('FAILED_RUN_ID', '')
MAX_RETRIES = int(os.environ.get('HEAL_RETRY_COUNT', '0'))

GH_HEADERS = {
    'Authorization': f'token {GITHUB_TOKEN}',
    'Accept': 'application/vnd.github.v3+json'
}


def get_run_logs(run_id):
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/actions/runs/{run_id}/logs'
    response = requests.get(url, headers=GH_HEADERS, allow_redirects=True)
    if response.status_code == 200:
        try:
            zip_file = zipfile.ZipFile(io.BytesIO(response.content))
            logs = []
            for name in zip_file.namelist():
                with zip_file.open(name) as f:
                    logs.append(f'=== {name} ===\n' + f.read().decode('utf-8', errors='ignore'))
            return '\n'.join(logs)
        except Exception as e:
            print(f'Error reading zip: {e}')
    return ''


def get_file(path):
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{path}'
    response = requests.get(url, headers=GH_HEADERS, params={'ref': BRANCH})
    if response.status_code == 200:
        data = response.json()
        content = base64.b64decode(data['content']).decode('utf-8')
        return content, data['sha']
    return None, None


def update_file(path, content, sha, message):
    url = f'https://api.github.com/repos/{REPO_OWNER}/{REPO_NAME}/contents/{path}'
    data = {
        'message': message,
        'content': base64.b64encode(content.encode('utf-8')).decode('utf-8'),
        'sha': sha,
        'branch': BRANCH
    }
    response = requests.put(url, headers=GH_HEADERS, json=data)
    return response.status_code in (200, 201)


def analyze_and_fix(logs):
    FILES = ['app.json', 'package.json', 'eas.json', '.github/workflows/build-submit.yml']

    file_contents = {}
    file_shas = {}
    for path in FILES:
        content, sha = get_file(path)
        if content:
            file_contents[path] = content
            file_shas[path] = sha

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    message = client.messages.create(
        model='claude-opus-4-7',
        max_tokens=4096,
        messages=[{
            'role': 'user',
            'content': f"""You are a React Native / Expo / EAS build expert.
A GitHub Actions build failed for a React Native Firebase app. Analyze the error and fix it.

BUILD LOGS:
{logs[-8000:]}

CURRENT FILE CONTENTS:
{json.dumps(file_contents, indent=2)}

Respond ONLY with valid JSON in this exact format, no other text:
{{
  "fixes": [
    {{
      "path": "file/path",
      "content": "complete corrected file content"
    }}
  ],
  "explanation": "what was wrong and what was fixed"
}}

Strict rules:
- Only include files that need changes
- Provide COMPLETE file content not partial
- Never change projectId in eas.json
- Never touch App.js
- Never change bundle identifiers"""
        }]
    )

    text = message.content[0].text.strip()
    if '```json' in text:
        text = text.split('```json')[1].split('```')[0].strip()
    elif '```' in text:
        text = text.split('```')[1].split('```')[0].strip()

    return json.loads(text), file_shas


def main():
    if MAX_RETRIES >= 3:
        print('Max retries (3) reached. Manual intervention required.')
        sys.exit(1)

    if not RUN_ID:
        print('No FAILED_RUN_ID provided')
        sys.exit(1)

    print(f'Fetching logs for failed run {RUN_ID}...')
    logs = get_run_logs(RUN_ID)
    if not logs:
        print('Could not fetch logs')
        sys.exit(1)

    print('Sending to Claude AI for analysis...')
    result, file_shas = analyze_and_fix(logs)

    explanation = result.get('explanation', 'unknown issue')
    print(f'Issue: {explanation}')

    fixes = result.get('fixes', [])
    if not fixes:
        print('Claude found no fixable changes needed')
        sys.exit(0)

    applied = []
    for fix in fixes:
        path = fix['path']
        content = fix['content']
        sha = file_shas.get(path)
        if not sha:
            print(f'Skipping {path} - not found in repo')
            continue
        success = update_file(
            path, content, sha,
            f'auto-fix[{MAX_RETRIES + 1}]: {explanation[:60]}'
        )
        if success:
            print(f'Fixed: {path}')
            applied.append(path)
        else:
            print(f'Failed to update: {path}')

    if applied:
        print(f'Applied fixes to: {applied}')
        print('New build will trigger automatically from the commit.')
    else:
        print('No files were updated')


if __name__ == '__main__':
    main()
