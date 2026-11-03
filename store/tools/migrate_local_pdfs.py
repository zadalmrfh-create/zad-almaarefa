"""Admin-only local migration helper for ZAD protected store PDFs.

Run on your own trusted machine, NEVER on GitHub Pages or in web JavaScript.
Requires a Google service-account with appropriately restricted access.

  pip install firebase-admin
  set GOOGLE_APPLICATION_CREDENTIALS=C:\\secure\\firebase-admin.json
  python store/tools/migrate_local_pdfs.py --source "C:\\your-original-unpacked-project" --bucket "zad-elmarefa.firebasestorage.app" --commit

Without --commit, performs a dry run. Only upload materials you are licensed to sell.
"""
import argparse
import json
import os
import sys
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
MANIFEST = HERE / "local-pdf-migration-manifest.json"
CATALOG = HERE / "catalog-data.js"

def main():
    parser = argparse.ArgumentParser(description="Move owned local PDFs to Firebase private Storage")
    parser.add_argument("--source", required=True, help="Unpacked original project directory, WITH the PDFs")
    parser.add_argument("--bucket", required=True, help="Exact Firebase Storage bucket name")
    parser.add_argument("--commit", action="store_true", help="Actually upload & update Firestore")
    args = parser.parse_args()
    source = Path(args.source).resolve()
    entries = json.loads(MANIFEST.read_text(encoding="utf-8"))
    import re
    content = CATALOG.read_text(encoding="utf-8")
    if not content.startswith("export const baseProducts = "):
        raise ValueError("Unexpected catalog format")
    raw = content[len("export const baseProducts = "):].strip().rstrip(";")
    products = {p["id"]:p for p in json.loads(raw)}
    selected = []
    for x in entries:
        path = source / x["relativePath"]
        if not path.is_file():
            print(f"SKIP missing: {x['productId']}  {path}")
            continue
        if path.suffix.lower() != ".pdf" or not path.resolve().is_relative_to(source):
            print(f"SKIP invalid: {path}")
            continue
        selected.append((x,path,products[x["productId"]]))
    print(f"Found {len(selected)} of {len(entries)} private PDF candidates.")
    if not args.commit:
        for x,p,_ in selected: print("DRY RUN",x["productId"],p.name)
        print("Nothing was uploaded. Pass --commit only after verifying distribution rights.")
        return
    if not os.environ.get("GOOGLE_APPLICATION_CREDENTIALS"):
        raise SystemExit("Set GOOGLE_APPLICATION_CREDENTIALS to a private service account JSON path (DO NOT COMMIT IT).")
    import firebase_admin
    from firebase_admin import credentials, firestore, storage
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred,{"storageBucket":args.bucket})
    db=firestore.client()
    bucket=storage.bucket()
    public_keys={"title","type","price","stage","grade","subject","teacherName","teacherUid","schedule","duration","description","contents","coverUrl","published","deleted","deliveryReady"}
    for x,source_file,p in selected:
        product_id=x["productId"]
        obj=f"storeProtected/{product_id}/{uuid.uuid4().hex}.pdf"
        print("Uploading:",product_id,source_file.name)
        blob=bucket.blob(obj)
        blob.upload_from_filename(str(source_file),content_type="application/pdf")
        private={k:v for k,v in p.items() if k not in {"previewUrl","directUrl","downloadUrl","videoUrl"}}
        private.update({"storagePath":obj,"deliveryReady":True,"published":True,"source":"library","updatedAt":firestore.SERVER_TIMESTAMP})
        safe={k:v for k,v in private.items() if k in public_keys}
        safe["updatedAt"]=firestore.SERVER_TIMESTAMP
        # Private and public metadata for the same product, no download tokens generated.
        db.collection("storeProducts").document(product_id).set(private,merge=True)
        db.collection("storePublicProducts").document(product_id).set(safe,merge=True)
        print("Ready:",product_id)
    print("Done. Remove original PDF files from the public GitHub Pages repository and revoke earlier links.")

if __name__=="__main__":
    main()
