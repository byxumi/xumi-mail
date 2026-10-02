#!/usr/bin/env python3
"""Xumi Mail logo generator - pure stdlib (zlib PNG), no PIL.

"Night Signal Station" mark:
  - Rounded-square tile in deep green #0b0f0d with rim #1d2a21.
  - Phosphor-green envelope glyph + radar arc above = incoming signal.
Outputs: logo-512.png, logo-192.png, logo-32.png, favicon.ico (32px png inside ico).
"""
import math, struct, zlib, os

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public')

def rounded_rect_sdf(px, py, cx, cy, hw, hh, r):
    qx = abs(px - cx) - (hw - r)
    qy = abs(py - cy) - (hh - r)
    ax, ay = max(qx, 0.0), max(qy, 0.0)
    return math.hypot(ax, ay) + min(max(qx, qy), 0.0) - r

def seg_dist(px, py, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    L2 = dx * dx + dy * dy
    if L2 == 0:
        return math.hypot(px - x1, py - y1)
    t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / L2))
    return math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))

def arc_dist(px, py, cx, cy, r, t0, t1):
    """Distance from point to circular arc (center cx,cy radius r, angles t0..t1)."""
    dx, dy = px - cx, py - cy
    ang = math.atan2(dy, dx)
    # wrap angle into [t0, t1]
    if ang < t0:
        ang += 2 * math.pi
    if ang > t1:
        ang -= 2 * math.pi
    if t0 <= ang <= t1:
        return abs(math.hypot(dx, dy) - r)
    # endpoints
    d1 = math.hypot(px - (cx + r * math.cos(t0)), py - (cy + r * math.sin(t0)))
    d2 = math.hypot(px - (cx + r * math.cos(t1)), py - (cy + r * math.sin(t1)))
    return min(d1, d2)

def render(size, ss=4):
    N = size * ss
    cx = cy = N / 2.0
    corner = N * 0.16
    tile_hw = N * 0.50
    rim_w = max(1.5, N * 0.014)

    TILE = (11, 15, 13)
    RIM = (29, 42, 33)
    GREEN = (0, 224, 138)
    GREEN_DIM = (0, 150, 94)

    # envelope geometry
    gx, gy = cx, cy + N * 0.03
    ew, eh = N * 0.27, N * 0.18
    ecorner = N * 0.055
    env_w = N * 0.040
    flap_w = N * 0.030

    # radar arcs (bright small, dim large)
    arcs = [
        (cx, cy - N * 0.30, N * 0.30, -math.pi * 0.72, -math.pi * 0.28, N * 0.030, GREEN),
        (cx, cy - N * 0.30, N * 0.42, -math.pi * 0.78, -math.pi * 0.22, N * 0.022, GREEN_DIM),
    ]

    out = bytearray()
    for y in range(size):
        for x in range(size):
            r_acc = g_acc = b_acc = a_acc = 0.0
            for sy in range(ss):
                for sx in range(ss):
                    px = (x + (sx + 0.5) / ss) * ss
                    py = (y + (sy + 0.5) / ss) * ss
                    d_tile = rounded_rect_sdf(px, py, cx, cy, tile_hw, tile_hw, corner)
                    # tile fill
                    cov = max(0.0, min(1.0, 0.5 - d_tile))
                    if cov > 0:
                        a_acc += cov
                        r_acc += cov * TILE[0]
                        g_acc += cov * TILE[1]
                        b_acc += cov * TILE[2]
                    # rim
                    rcov = max(0.0, min(1.0, (rim_w / 2.0 - abs(d_tile)) / 1.0))
                    if rcov > 0:
                        a_acc += rcov
                        r_acc += rcov * RIM[0]
                        g_acc += rcov * RIM[1]
                        b_acc += rcov * RIM[2]
                    # envelope outline
                    d_env = rounded_rect_sdf(px, py, gx, gy, ew, eh, ecorner)
                    ecov = max(0.0, min(1.0, (env_w / 2.0 - abs(d_env)) / 1.0))
                    if ecov > 0:
                        a_acc += ecov
                        r_acc += ecov * GREEN[0]
                        g_acc += ecov * GREEN[1]
                        b_acc += ecov * GREEN[2]
                    # flap chevron
                    for (x1, y1), (x2, y2) in [
                        ((gx - ew * 0.74, gy - eh * 0.70), (gx + ew * 0.00, gy + eh * 0.52)),
                        ((gx + ew * 0.74, gy - eh * 0.70), (gx + ew * 0.00, gy + eh * 0.52)),
                    ]:
                        dfl = seg_dist(px, py, x1, y1, x2, y2)
                        fcov = max(0.0, min(1.0, (flap_w / 2.0 - dfl) / 1.0))
                        if fcov > 0:
                            a_acc += fcov
                            r_acc += fcov * GREEN[0]
                            g_acc += fcov * GREEN[1]
                            b_acc += fcov * GREEN[2]
                    # radar arcs
                    for (acx, acy, ar, t0, t1, aw, acol) in arcs:
                        dad = arc_dist(px, py, acx, acy, ar, t0, t1)
                        acov = max(0.0, min(1.0, (aw / 2.0 - dad) / 1.0))
                        if acov > 0:
                            a_acc += acov
                            r_acc += acov * acol[0]
                            g_acc += acov * acol[1]
                            b_acc += acov * acol[2]
            if a_acc > 0:
                n = a_acc
                out += bytes((int(r_acc / n + 0.5), int(g_acc / n + 0.5), int(b_acc / n + 0.5), int(min(1.0, a_acc) * 255 + 0.5)))
            else:
                out += bytes((0, 0, 0, 0))
    return bytes(out)

def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        c += struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        return c
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    # filter byte 0 per row
    stride = size * 4
    filtered = bytearray()
    for y in range(size):
        filtered.append(0)
        filtered += raw[y * stride:(y + 1) * stride]
    idat = zlib.compress(bytes(filtered), 9)
    with open(path, 'wb') as f:
        f.write(sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b''))

def write_ico(path, png_bytes):
    # single 32x32 png-embedded ico
    header = struct.pack('<HHH', 0, 1, 1)
    entry = struct.pack('<BBBBHHII', 32, 32, 0, 0, 1, 32, len(png_bytes), 22)
    with open(path, 'wb') as f:
        f.write(header + entry + png_bytes)

if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for size, name in [(512, 'logo-512.png'), (192, 'logo-192.png'), (32, 'logo-32.png')]:
        raw = render(size)
        write_png(os.path.join(OUT, name), size, raw)
        print('wrote', name)
    # favicon.ico: 32px png
    raw32 = render(32)
    png32 = bytearray()
    # reuse write_png logic inline
    def chunk(tag, data):
        c = struct.pack('>I', len(data)) + tag + data
        c += struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
        return c
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', 32, 32, 8, 6, 0, 0, 0)
    stride = 32 * 4
    filtered = bytearray()
    for y in range(32):
        filtered.append(0)
        filtered += raw32[y * stride:(y + 1) * stride]
    idat = zlib.compress(bytes(filtered), 9)
    png32 = sig + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')
    write_ico(os.path.join(OUT, 'favicon.ico'), bytes(png32))
    print('wrote favicon.ico')
