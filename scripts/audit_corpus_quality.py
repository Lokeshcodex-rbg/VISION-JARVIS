import os
import json
import glob

def main():
    mani_path = "data/corpus_raw/acquisition_manifest.json"
    mani = json.load(open(mani_path, "r", encoding="utf-8"))
    acquired = mani.get("acquired", [])
    print(f"Total downloaded GB: {mani.get('total_downloaded_gb')}")
    print(f"Total files: {mani.get('total_files')}")
    print(f"Acquired datasets: {len(acquired)}")
    
    dataset_summary = []
    for a in acquired:
        ds_id = a.get("id")
        repo_id = a.get("repo_id")
        lic = a.get("license")
        card_lic = a.get("card_license")
        domain = a.get("domain")
        stage_role = a.get("stage_role")
        origin = a.get("origin_class")
        b_down = a.get("downloaded_bytes", 0)
        file_list = a.get("files", [])
        
        # Check actual files on disk
        disk_files = []
        disk_bytes = 0
        for fentry in file_list:
            lp = fentry.get("local_path")
            if lp and os.path.exists(lp):
                disk_files.append(lp)
                disk_bytes += os.path.getsize(lp)

        dataset_summary.append({
            "id": ds_id,
            "repo_id": repo_id,
            "license": lic,
            "card_license": card_lic,
            "domain": domain,
            "stage_role": stage_role,
            "origin_class": origin,
            "manifest_bytes": b_down,
            "actual_disk_files": len(disk_files),
            "actual_disk_bytes": disk_bytes,
            "file_types": list(set(os.path.splitext(f)[1] for f in disk_files))
        })
        print(f"{ds_id:30s} | {repo_id:35s} | Lic: {lic:12s} | Files: {len(disk_files):2d} | MB: {disk_bytes/(1024**2):7.1f} | Domain: {domain}")

    with open("VISION_RAW_CORPUS_AUDIT.json", "w", encoding="utf-8") as f:
        json.dump({"summary": dataset_summary, "total_datasets": len(dataset_summary)}, f, indent=2)

if __name__ == "__main__":
    main()
