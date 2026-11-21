// Product PNGs are 16:9 with the manifold off-centre. Siatka crops them to 4:3 (object-fit: cover),
// so each photo needs its own object-position-x to keep the whole manifold in frame.
// Values come from the alpha bounding box of each PNG in src/assets/products.
const focus: Record<string, number> = {
  'rw-ezmpt': 16,
  'rw-ezmptr': 16,
  'rw-zz0': 50,
  'rwko-ptpex': 86,
};

export function focusX(slug: string): number {
  return focus[slug] ?? 70;
}
