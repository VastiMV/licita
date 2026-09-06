"""Gera `logo.png` — a marca "Inside Solutions" que vai no cabeçalho da
planilha de proposta (`apps/cotador/planilha.py`).

A marca oficial é o SVG de `frontend/src/app/layout/brand/brand.component.html`
(dois quadriláteros, navy e azul). O openpyxl só embute bitmap, então o
PNG é gerado aqui a partir da mesma geometria — assim a planilha e a tela
não divergem quando a marca mudar: muda o SVG, roda este script de novo.

    python apps/cotador/assets/gerar_logo.py

O PNG resultante é versionado (o build da imagem não roda este script).
"""

from PIL import Image, ImageDraw

NAVY = (22, 41, 77, 255)
AZUL = (43, 124, 196, 255)

# Mesmos pontos do `viewBox="0 0 40 40"` do brand.component.html.
SUPERIOR = [(4, 2), (18, 2), (38, 20), (24, 20)]
INFERIOR = [(24, 20), (38, 20), (18, 38), (4, 38)]

LADO = 320
# Desenha 4x maior e reduz: é o antialias do contorno diagonal, que numa
# planilha aparece bem mais do que na tela.
ESCALA = 4


def gerar(destino: str = "logo.png") -> None:
    tamanho = LADO * ESCALA
    fator = tamanho / 40
    imagem = Image.new("RGBA", (tamanho, tamanho), (255, 255, 255, 0))
    desenho = ImageDraw.Draw(imagem)
    for pontos, cor in ((SUPERIOR, NAVY), (INFERIOR, AZUL)):
        desenho.polygon([(x * fator, y * fator) for x, y in pontos], fill=cor)
    imagem.resize((LADO, LADO), Image.LANCZOS).save(destino)


if __name__ == "__main__":
    from pathlib import Path

    gerar(str(Path(__file__).with_name("logo.png")))
