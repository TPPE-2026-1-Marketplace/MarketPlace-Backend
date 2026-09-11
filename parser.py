import json
import requests
import sys
from datetime import datetime
 
TODAY = datetime.now()
 
METRICS_SONAR = [
    'files',
    'functions',
    'complexity',
    'comment_lines_density',
    'duplicated_lines_density',
    'coverage',
    'ncloc',
    'tests',
    'test_errors',
    'test_failures',
    'test_execution_time',
    'security_rating',
    'test_success_density',
    'reliability_rating',
]
 
BASE_URL_SONAR = 'https://sonarcloud.io/api/measures/component_tree?component=TPPE-2026.1-Marketplace_'
OWNER = "TPPE-2026.1-Marketplace"
 
def save_sonar_metrics(tag):
    response = requests.get(f'{BASE_URL_SONAR}{REPO}&metricKeys={",".join(METRICS_SONAR)}&ps=500')
 
    j = json.loads(response.text)
 
    print("Extração do Sonar concluída.")
 
    file_path = f'./qa-analytics/analytics-raw-data/TPPE-2026.1-Marketplace-{REPO}-{TODAY.strftime("%m-%d-%Y-%H-%M-%S")}-{tag}.json'
 
    with open(file_path, 'w') as fp:
        fp.write(json.dumps(j))
        fp.close()
 
    return
 
def all_request_pages(data):
    total_runs = data["total_count"]
    pages = (total_runs // 100) + (1 if total_runs % 100 > 0 else 0)
    for i in range(pages+1):
        if i == 0 or i == 1:
            continue
        api_url_now = api_url_runs + "?page=" + str(i)
        response = requests.get(api_url_now)
        for j in ((response.json()['workflow_runs'])):
            data['workflow_runs'].append(j)
    return data
 
def filter_request_per_date(data, date):
    data_filtered = []
    for i in data["workflow_runs"]:
        if datetime.strptime(i["created_at"][:10],"%Y-%m-%d").strftime("%Y-%m-%d") == date:
            data_filtered.append(i)
    return {"workflow_runs": data_filtered}
 
if __name__ == '__main__':
 
    REPO = sys.argv[1]
    RELEASE_VERSION = sys.argv[2]

    save_sonar_metrics(RELEASE_VERSION)