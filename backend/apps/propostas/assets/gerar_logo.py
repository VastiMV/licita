"""Gera `logo.png` — a marca do sistema em alta resolução para o timbrado.

É a mesma marca de `frontend/src/app/layout/brand/brand.component.html`: os
dois quadriláteros (navy e azul, mesma geometria do `viewBox="0 0 40 40"`)
e o "INSIDE / solutions" em Montserrat, com o peso, as cores e o
espaçamento entre letras de `brand.component.scss`. O PNG de
`apps/cotador/assets/logo.png` tem só o símbolo, em 320 px — pequeno para
impressão.

    python apps/propostas/assets/gerar_logo.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).parent
FONTE = AQUI / "montserrat.ttf"  # variável (OFL), a mesma do Google Fonts da tela

NAVY = (0x16, 0x29, 0x4D, 255)
AZUL = (0x2B, 0x7C, 0xC4, 255)
SUPERIOR = [(4, 2), (18, 2), (38, 20), (24, 20)]
INFERIOR = [(24, 20), (38, 20), (18, 38), (4, 38)]

# Proporções da tela: símbolo 30px, "INSIDE" 1.15rem (18.4px), "solutions"
# 0.72rem (11.5px), espaço 0.7rem entre símbolo e nome.
ESCALA = 40  # 30px de símbolo viram 1200px
SIMBOLO = 30 * ESCALA
TAM_INSIDE = round(18.4 * ESCALA)
TAM_SOLUTIONS = round(11.5 * ESCALA)
ESPACO = round(11.2 * ESCALA)


def fonte(tamanho: int, peso: str) -> ImageFont.FreeTypeFont:
    f = ImageFont.truetype(str(FONTE), tamanho)
    f.set_variation_by_name(peso)
    return f


def largura_espacada(texto: str, f, espaco: float) -> int:
    return round(sum(f.getlength(c) for c in texto) + espaco * (len(texto) - 1))


def escrever(desenho, x: int, y: int, texto: str, f, espaco: float, cor) -> None:
    for c in texto:
        desenho.text((x, y), c, font=f, fill=cor)
        x += f.getlength(c) + espaco


def gerar(destino: Path = AQUI / "logo.png") -> None:
    inside = fonte(TAM_INSIDE, "Bold")
    solutions = fonte(TAM_SOLUTIONS, "Regular")
    esp_inside = 0.14 * TAM_INSIDE
    esp_solutions = 0.28 * TAM_SOLUTIONS

    largura_nome = max(
        largura_espacada("INSIDE", inside, esp_inside),
        largura_espacada("solutions", solutions, esp_solutions),
    )
    largura = SIMBOLO + ESPACO + largura_nome
    imagem = Image.new("RGBA", (largura, SIMBOLO), (255, 255, 255, 0))
    desenho = ImageDraw.Draw(imagem)

    fator = SIMBOLO / 40
    for pontos, cor in ((SUPERIOR, NAVY), (INFERIOR, AZUL)):
        desenho.polygon([(x * fator, y * fator) for x, y in pontos], fill=cor)

    # O bloco do nome centralizado na altura do símbolo, como o flex da tela.
    topo_i, base_i = inside.getbbox("INSIDE")[1], inside.getbbox("INSIDE")[3]
    topo_s, base_s = solutions.getbbox("solutions")[1], solutions.getbbox("solutions")[3]
    entre = 2 * ESCALA
    altura_nome = (base_i - topo_i) + entre + (base_s - topo_s)
    y = (SIMBOLO - altura_nome) // 2
    x = SIMBOLO + ESPACO
    escrever(desenho, x, y - topo_i, "INSIDE", inside, esp_inside, NAVY)
    escrever(desenho, x, y + (base_i - topo_i) + entre - topo_s, "solutions", solutions, esp_solutions, AZUL)

    imagem.save(destino)


if __name__ == "__main__":
    gerar()
