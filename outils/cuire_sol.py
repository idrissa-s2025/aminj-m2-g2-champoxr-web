"""Cuit le plan du sol du campus : couleurs franches par revetement, bords de chaussee et
lignes mediane a partir de la carte de melange (rouge enrobe, vert pavage, bleu gravillon,
noir gazon). Cote du cadre : 438 m. Sortie 6144 px, soit 7,1 cm par pixel."""
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage as ndi
from skimage.morphology import skeletonize

N = 6144
COTE = 438.0
PX = COTE / N                                     # metres par pixel
carte = Image.open('splat.png').convert('RGB').resize((N, N), Image.BILINEAR)
a = np.asarray(carte).astype(np.float32) / 255.0
del carte
R, V, B = a[..., 0], a[..., 1], a[..., 2]

# Teintes claires, facon plan d'architecte (reference ESNbyUM)
GAZON = np.array([138, 188, 94]); ENROBE = np.array([142, 147, 154])
PAVAGE = np.array([226, 220, 206]); GRAVIL = np.array([222, 204, 166])
LIGNE = np.array([248, 248, 244])
c = np.broadcast_to(GAZON, a.shape).astype(np.float32).copy()
for poids, teinte in ((R, ENROBE), (V, PAVAGE), (B, GRAVIL)):
    c = c * (1 - poids[..., None]) + teinte * poids[..., None]

# Bordure claire autour des surfaces dures (trottoir, bordure de pelouse) : 25 cm
dur = (R + V + B) > 0.5
bord_dur = dur & ~ndi.binary_erosion(dur, iterations=max(1, round(0.25 / PX)))
c[bord_dur & (R < 0.5)] = c[bord_dur & (R < 0.5)] * 0.55 + LIGNE * 0.45

# Chaussee : ligne de rive continue a 40 cm du bord, 12 cm de large
route = R > 0.5
route = ndi.binary_opening(route, iterations=3)
dist = (ndi.distance_transform_edt(route).astype(np.float32) * PX)
rive = (dist > 0.40) & (dist < 0.52)
# Mediane en tirets (3 m trace, 3,5 m vide) sur les voies de 5 a 12 m de large
sq = skeletonize(route)
mediane = sq & (dist > 2.4) & (dist < 6.0)
# pas de mediane dans les parkings et les places : la chaussee doit y etre etroite autour
densite = ndi.uniform_filter(route.astype(np.float32), size=int(16 / PX))
mediane &= densite < 0.5
etiq, n = ndi.label(mediane, structure=np.ones((3, 3)))
taille = ndi.sum(mediane, etiq, index=np.arange(1, n + 1))
mediane = np.isin(etiq, np.nonzero(taille * PX > 12)[0] + 1)
del etiq, densite
mediane = ndi.binary_dilation(mediane, iterations=max(1, round(0.06 / PX)))
c[rive] = LIGNE
del rive
iy, ix = np.nonzero(mediane & route)
garde = ((ix + iy) * PX % 6.5) < 3.0
c[iy[garde], ix[garde]] = LIGNE

img = Image.fromarray(np.clip(c, 0, 255).astype(np.uint8))
img = img.filter(ImageFilter.GaussianBlur(0.6))
img.save('sol_plan.jpg', quality=90, optimize=True)
img.resize((1024, 1024), Image.LANCZOS).save('sol_plan_apercu.png')
print('ok', N, round(PX * 100, 1), 'cm/px')
