"""ワークシートの PDF 版を作る。実行: python3 tools/worksheet-pdf.py

Word 版（docs/worksheets/hanzo-roleplay.docx）が原本。UD デジタル教科書体は Windows にしかないため、
PDF 版は行の高さが近い IPAゴシックに置き換えて LibreOffice で書き出す。字形と改行位置は Word 版と少し異なる。
必要なもの: LibreOffice（soffice）と IPAゴシック（Debian/Ubuntu なら fonts-ipafont-gothic）。
"""
import pathlib
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'docs/worksheets/hanzo-roleplay.docx'
OUT = SRC.with_suffix('.pdf')
SUBSTITUTE = {'UD Digi Kyokasho NK-R': 'IPAGothic', 'UD Digi Kyokasho NK-B': 'IPAGothic'}


def main():
    soffice = shutil.which('soffice') or shutil.which('libreoffice')
    if not soffice:
        sys.exit('LibreOffice（soffice）が見つかりません。')
    with tempfile.TemporaryDirectory() as tmp:
        docx = pathlib.Path(tmp) / SRC.name
        with zipfile.ZipFile(SRC) as zin, zipfile.ZipFile(docx, 'w', zipfile.ZIP_DEFLATED) as zout:
            for item in zin.infolist():
                data = zin.read(item.filename)
                if item.filename.endswith('.xml'):
                    text = data.decode('utf-8')
                    for old, new in SUBSTITUTE.items():
                        text = text.replace('"' + old + '"', '"' + new + '"')
                    data = text.encode('utf-8')
                zout.writestr(item, data)
        subprocess.run([soffice, '--headless', '--convert-to', 'pdf', '--outdir', tmp, str(docx)],
                       check=True, stdout=subprocess.DEVNULL, timeout=180)
        shutil.copyfile(docx.with_suffix('.pdf'), OUT)
    print('✔', OUT.relative_to(ROOT))


if __name__ == '__main__':
    main()
