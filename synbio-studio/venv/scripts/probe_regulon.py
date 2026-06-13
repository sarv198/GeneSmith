import requests

urls = [
    "https://regulondb.ccg.unam.mx/menu/download/datasets/files/PromoterSet.txt",
    "https://media.githubusercontent.com/media/maalcantar/promoter_ML/master/data/RegulonDB/20191127_PromoterSet.txt",
    "https://github.com/maalcantar/promoter_ML/raw/master/data/RegulonDB/20191127_PromoterSet.txt",
]
headers = {"User-Agent": "Mozilla/5.0"}
for u in urls:
    r = requests.get(u, headers=headers, timeout=60, verify=False)
    print(u.split("/")[-1], r.status_code, len(r.content), r.text[:80].replace("\n", " "))
