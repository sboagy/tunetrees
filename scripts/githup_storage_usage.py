import subprocess
import os

# Credit to https://github.com/Warfront1 for the script,
# which will list all the repositories in a GitHub account and calculate
# the total size of all artifacts in each repository.

GH_ACCOUNT = os.getenv("GITT_OWNER")
command = f'gh repo list {GH_ACCOUNT} --json name -q ".[].name"'

repos = subprocess.check_output(command, shell=True, text=True).strip().split("\n")

for repo in repos:
    command = f'gh api /repos/{GH_ACCOUNT}/{repo}/actions/artifacts -q ".artifacts[].size_in_bytes"'
    result = subprocess.check_output(command, shell=True, text=True)

    sizes = [
        int(size) for size in result.split() if size.isdigit()
    ]  # convert to integers

    total_size_in_mb = sum(sizes) / (1024 * 1024)  # Convert from bytes to MB

    print(f"Total artifact size for repository {repo}: {total_size_in_mb:.2f} MB")
