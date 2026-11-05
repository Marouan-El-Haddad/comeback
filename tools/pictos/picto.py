"""Pictogram engine: stylised exercise figures drawn as SVG.

Coordinates are y-up with the floor at y = 0. A figure faces right unless
its pose says otherwise. Limbs are solved with two-bone IK so hands and feet
land exactly on floors, books, chairs and walls.
"""
import math

SHIN, THIGH, TORSO, UPPER, FORE, NECK = 23.0, 24.0, 30.0, 16.0, 15.0, 11.0
HEAD_R = 6.4

INK = "#2D2A4A"      # Thai navy: near-side limbs
FAR = "#A7A3BE"      # far-side limbs
HI = "#A51931"       # Thai red: working segment highlight
GHOST = "#DCD9E6"    # earlier/later position
PROP = "#E9E7F0"     # prop fill
PROP_LINE = "#B9B5CB"
ARROW = "#A51931"

W_LIMB, W_TORSO = 6.6, 8.6


def _add(p, d, ang):
    a = math.radians(ang)
    return (p[0] + d * math.cos(a), p[1] + d * math.sin(a))


def _ang(a, b):
    return math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))


def ik(root, target, l1, l2, bend):
    """Two-bone IK. bend = +1 / -1 picks which side the middle joint goes."""
    dx, dy = target[0] - root[0], target[1] - root[1]
    d = math.hypot(dx, dy)
    d_eff = max(min(d, l1 + l2 - 1e-6), abs(l1 - l2) + 1e-6)
    base = math.atan2(dy, dx)
    cos_a = (l1 * l1 + d_eff * d_eff - l2 * l2) / (2 * l1 * d_eff)
    a = math.acos(max(-1.0, min(1.0, cos_a)))
    j = (root[0] + l1 * math.cos(base + bend * a), root[1] + l1 * math.sin(base + bend * a))
    if d > l1 + l2:  # unreachable: straight limb toward target
        e = (root[0] + (l1 + l2) * math.cos(base), root[1] + (l1 + l2) * math.sin(base))
        j = (root[0] + l1 * math.cos(base), root[1] + l1 * math.sin(base))
        return j, e
    e = (j[0] + l2 * math.cos(math.atan2(target[1] - j[1], target[0] - j[0])),
         j[1] + l2 * math.sin(math.atan2(target[1] - j[1], target[0] - j[0])))
    return j, e


class Fig:
    """A posed figure. Build with hip + torso angle, then limb targets."""

    def __init__(self, hip, torso_deg, head_off=0.0, head=None, shoulder=None):
        self.hip = hip
        self.sh = shoulder if shoulder else _add(hip, TORSO, torso_deg)
        t = _ang(self.hip, self.sh)
        self.head = head if head else _add(self.sh, NECK, t + head_off)
        self.limbs = []  # (side, kind, root, joint, end, foot_or_hand_tip)

    def arm(self, side, target, bend, tip=None, upper=UPPER, fore=FORE):
        j, e = ik(self.sh, target, upper, fore, bend)
        self.limbs.append((side, "arm", self.sh, j, e, tip))
        return self

    def leg(self, side, target, bend, foot=None, thigh=THIGH, shin=SHIN):
        """foot: absolute toe point, or angle in degrees (length 7)."""
        j, e = ik(self.hip, target, thigh, shin, bend)
        tip = None
        if foot is not None:
            tip = foot if isinstance(foot, tuple) else _add(e, 7.5, foot)
        self.limbs.append((side, "leg", self.hip, j, e, tip))
        return self


def _pt(p, H):
    return f"{p[0]:.2f},{H - p[1]:.2f}"


class Canvas:
    def __init__(self):
        self.items = []  # (z, svg-builder lambda(H) )
        self.pts = []

    def _track(self, *ps, pad=0):
        for p in ps:
            self.pts.append((p[0] - pad, p[1] - pad))
            self.pts.append((p[0] + pad, p[1] + pad))

    # ---- primitives ------------------------------------------------------
    def line(self, a, b, color, w, z=5, dash=None, cap="round", opacity=1):
        self._track(a, b, pad=w / 2)
        d = f' stroke-dasharray="{dash}"' if dash else ""
        o = f' stroke-opacity="{opacity}"' if opacity != 1 else ""
        self.items.append((z, lambda H: f'<line x1="{a[0]:.2f}" y1="{H-a[1]:.2f}" x2="{b[0]:.2f}" y2="{H-b[1]:.2f}" stroke="{color}" stroke-width="{w}" stroke-linecap="{cap}"{d}{o}/>'))

    def poly(self, ps, color, w, z=5, fill="none", close=False, join="round"):
        self._track(*ps, pad=w / 2)
        tag = "polygon" if close else "polyline"
        self.items.append((z, lambda H: f'<{tag} points="' + " ".join(_pt(p, H) for p in ps) + f'" fill="{fill}" stroke="{color}" stroke-width="{w}" stroke-linejoin="{join}" stroke-linecap="round"/>'))

    def circle(self, c, r, fill, z=6, stroke="none", sw=0):
        self._track(c, pad=r + sw)
        self.items.append((z, lambda H: f'<circle cx="{c[0]:.2f}" cy="{H-c[1]:.2f}" r="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'))

    def rect(self, x, y, w, h, fill=PROP, stroke=PROP_LINE, sw=1.2, rx=1.5, z=1):
        self._track((x, y), (x + w, y + h), pad=sw)
        self.items.append((z, lambda H: f'<rect x="{x:.2f}" y="{H-(y+h):.2f}" width="{w:.2f}" height="{h:.2f}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>'))

    def path(self, d_fn, track, z=8, stroke=ARROW, w=1.6, fill="none", extra=""):
        self._track(*track, pad=w)
        self.items.append((z, lambda H: f'<path d="{d_fn(H)}" fill="{fill}" stroke="{stroke}" stroke-width="{w}" stroke-linecap="round" stroke-linejoin="round" {extra}/>'))

    # ---- figure ----------------------------------------------------------
    def figure(self, f, mode="solid", hi=(), z0=10):
        """mode: solid | ghost | light. hi: set of (side, kind, seg) to colour red."""
        def col(side, key):
            if mode == "ghost":
                return GHOST
            if mode == "white":
                return "#FFFFFF" if side == "near" else "#F2B8C2"
            if mode == "shadow":
                return "#2D2A4A"
            if key in hi:
                return HI
            return INK if side == "near" else FAR
        zbase = z0 if mode != "ghost" else 2
        order = {"far": 0, "near": 3}
        for side, kind, root, j, e, tip in f.limbs:
            z = zbase + order[side] + (0.5 if kind == "arm" else 0)
            c1 = col(side, (side, kind, 1))
            c2 = col(side, (side, kind, 2))
            self.line(root, j, c1, W_LIMB, z)
            self.line(j, e, c2, W_LIMB, z + 0.1)
            if tip is not None:
                self.line(e, tip, c2, W_LIMB * 0.8, z + 0.1)
        tc = GHOST if mode == "ghost" else ("#FFFFFF" if mode == "white" else ("#2D2A4A" if mode == "shadow" else (HI if ("torso",) in hi else INK)))
        self.line(f.hip, f.sh, tc, W_TORSO, zbase + 1)
        hc = GHOST if mode == "ghost" else ("#FFFFFF" if mode == "white" else ("#2D2A4A" if mode == "shadow" else INK))
        self.circle(f.head, HEAD_R, hc, zbase + 1.2)

    # ---- props -------------------------------------------------------------
    def floor(self, x1, x2, y=0):
        self.line((x1, y - 1.2), (x2, y - 1.2), PROP_LINE, 1.4, z=0, cap="butt")

    def wall(self, x, y1, y2, side=+1):
        """side=+1: room is to the left of the wall (hatch to the right)."""
        self.line((x, y1), (x, y2), PROP_LINE, 1.6, z=0, cap="butt")
        n = int((y2 - y1) / 6)
        for i in range(n):
            yy = y1 + 3 + i * 6
            self.line((x, yy), (x + side * 4, yy + 4), PROP_LINE, 1.0, z=0, cap="butt")

    def box(self, x, y, w, h):
        self.rect(x, y, w, h, rx=2)

    def chair(self, x, w, h):
        self.rect(x, h - 4, w, 4, rx=1.5)
        self.line((x + 2.5, 0), (x + 2.5, h - 4), PROP_LINE, 2.2, z=0, cap="butt")
        self.line((x + w - 2.5, 0), (x + w - 2.5, h - 4), PROP_LINE, 2.2, z=0, cap="butt")

    def table(self, x1, x2, h):
        self.rect(x1, h - 3.2, x2 - x1, 3.2, rx=1.2)
        self.line((x2 - 3, 0), (x2 - 3, h - 3.2), PROP_LINE, 2.4, z=0, cap="butt")

    def books(self, x, w=9, n=3, th=2.4, y=0):
        for i in range(n):
            off = (i % 2) * 0.8
            self.rect(x + off, y + i * th, w, th - 0.4, rx=0.6, fill="#F3EFE6" if i % 2 else "#E9E7F0")

    def towel(self, x, w, y=0):
        self.rect(x, y, w, 2.0, rx=1.0, fill="#F6E3E6", stroke="#E3B5BE")

    def pillow(self, x, w, y=0):
        self.rect(x, y, w, 3.4, rx=1.7, fill="#ECEAF3", stroke=PROP_LINE)

    def backpack(self, cx, top, z=13):
        self.rect(cx - 4.5, top - 11, 9, 11, rx=2.6, fill="#D9D5E6", stroke="#9C97B3", sw=1.0, z=z)

    def couch(self, x1, x2, h=20, back=34, side_low=7):
        # base with an opening under the front edge (for anchoring feet)
        self.rect(x1, side_low, x2 - x1, h - side_low, rx=2.5)
        self.rect(x1, h, 7, back - h, rx=2.5)
        self.line((x1 + 3, 0), (x1 + 3, side_low), PROP_LINE, 2.2, z=0, cap="butt")
        self.line((x2 - 3, 0), (x2 - 3, side_low), PROP_LINE, 2.2, z=0, cap="butt")

    def arc_arrow(self, c, r, a1, a2, head=True, color=ARROW, w=1.7, z=12):
        """Arc from angle a1 to a2 (deg, y-up) around centre c, arrowhead at a2."""
        p1, p2 = _add(c, r, a1), _add(c, r, a2)
        large = 1 if abs(a2 - a1) > 180 else 0
        sweep = 0 if a2 > a1 else 1  # y flipped in SVG
        def d(H):
            s = f"M {p1[0]:.2f} {H-p1[1]:.2f} A {r} {r} 0 {large} {sweep} {p2[0]:.2f} {H-p2[1]:.2f}"
            return s
        n = 16
        track = [_add(c, r, a1 + (a2 - a1) * i / n) for i in range(n + 1)]
        self.path(d, track, z=z, stroke=color, w=w)
        if head:
            tang = a2 + (90 if a2 > a1 else -90)
            self._head(p2, tang, color, z)

    def straight_arrow(self, a, b, color=ARROW, w=1.7, z=12):
        self.line(a, b, color, w, z, cap="round")
        self._head(b, _ang(a, b), color, z)

    def _head(self, tip, ang_deg, color, z):
        l, half = 4.2, 26
        p1 = _add(tip, l, ang_deg + 180 - half)
        p2 = _add(tip, l, ang_deg + 180 + half)
        self.items.append((z + 0.1, lambda H: f'<polygon points="{_pt(p1,H)} {_pt(tip,H)} {_pt(p2,H)}" fill="{color}" stroke="{color}" stroke-width="0.8" stroke-linejoin="round"/>'))
        self._track(p1, p2, tip)

    # ---- output -------------------------------------------------------------
    def svg(self, scale=1.0, pad=3.0, cls="picto", minw=None, label=None):
        xs = [p[0] for p in self.pts]
        ys = [p[1] for p in self.pts]
        x0, x1 = min(xs) - pad, max(xs) + pad
        y0, y1 = min(ys) - pad, max(ys) + pad
        if minw and (x1 - x0) < minw:
            extra = (minw - (x1 - x0)) / 2
            x0 -= extra
            x1 += extra
        W, Hh = x1 - x0, y1 - y0
        H = y1  # flip reference: svg_y = H - y ; top edge = y1
        body = "".join(fn(H) for z, fn in sorted(self.items, key=lambda t: t[0]))
        aria = f' role="img" aria-label="{label}"' if label else ' aria-hidden="true"'
        return (f'<svg class="{cls}" xmlns="http://www.w3.org/2000/svg" viewBox="{x0:.1f} {0:.1f} {W:.1f} {Hh:.1f}" '
                f'width="{W*scale:.1f}" height="{Hh*scale:.1f}"{aria}>'
                f'<g transform="translate(0,{-(H - y1) - 0:.2f})">{body}</g></svg>')
