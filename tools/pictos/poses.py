"""Exercise pictograms built on picto.py. Each function returns an SVG string.

Geometry notes: floor y = 0, figure faces right unless stated. Hands and feet
that stay planted keep the same coordinates in the ghost (start) and solid
(end) positions, so the movement reads correctly.
"""
import math
from picto import (Fig, Canvas, _add, _ang, ik, SHIN, THIGH, TORSO, UPPER, FORE,
                   NECK, HEAD_R, HI, INK, FAR, GHOST, PROP_LINE)

S = 1.0
BODY = SHIN + THIGH + TORSO  # ankle to shoulder, straight body (77)
LEG = SHIN + THIGH           # 47


def _plank_line(ankle, sh_y):
    """Straight body from ankle; returns (theta, hip, shoulder)."""
    th = math.degrees(math.asin((sh_y - ankle[1]) / BODY))
    return th, _add(ankle, LEG, th), _add(ankle, BODY, th)


def _feet(f, ankle, toe_dx=3.4):
    f.leg("far", (ankle[0] - 1.2, ankle[1]), 1, foot=(ankle[0] + toe_dx - 1.2, 0.3))
    f.leg("near", ankle, 1, foot=(ankle[0] + toe_dx, 0.3))


# ---------------------------------------------------------------- push family
def push_up(scale=S, label="Push-up"):
    c = Canvas()
    ank = (0.0, 3.6)
    th_t, hip_t, sh_t = _plank_line(ank, 31.5)
    th_b, hip_b, sh_b = _plank_line(ank, 10.8)
    hand = (sh_t[0] - 2.6, 0.0)
    top = Fig(hip_t, th_t, head_off=-4)
    top.arm("far", (hand[0] + 1.4, 0), 1).arm("near", hand, 1)
    _feet(top, ank)
    bot = Fig(hip_b, th_b, head_off=-4)
    bot.arm("far", (hand[0] + 1.4, 0), -1, upper=12.5).arm("near", hand, -1, upper=12.5)
    _feet(bot, ank)
    c.figure(top, "ghost")
    c.figure(bot, "solid", hi={("near", "arm", 1)})
    c.floor(-6, sh_b[0] + 16)
    return c.svg(scale, label=label)


def one_arm_push_up(scale=S):
    """Side view: free arm on the lower back, feet wide (hidden)."""
    c = Canvas()
    ank = (0.0, 3.6)
    th, hip, sh = _plank_line(ank, 30.5)
    hand = (sh[0] - 1.5, 0.0)
    f = Fig(hip, th, head_off=-4)
    f.arm("near", hand, 1)
    _feet(f, ank)
    c.figure(f, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    # free arm folded onto the lower back, drawn on top of the torso
    nrm = th + 90
    el = _add(_add(ank, 64.0, th), 5.2, nrm)
    hd = _add(_add(ank, 50.0, th), 5.6, nrm)
    c.line(sh, el, FAR, 6.0, 12.6)
    c.line(el, hd, FAR, 6.0, 12.7)
    c.floor(-6, sh[0] + 16)
    return c.svg(scale, label="Etarms push-up")


def deficit_push_up(scale=S):
    c = Canvas()
    ank = (0.0, 3.6)
    bh = 7.2
    th_t, hip_t, sh_t = _plank_line(ank, bh + 30.4)
    th_b, hip_b, sh_b = _plank_line(ank, 9.6)
    hand = (sh_t[0] - 2.6, bh)
    c.books(hand[0] - 5.5, w=11, n=3, th=2.4)
    top = Fig(hip_t, th_t, head_off=-4)
    top.arm("far", (hand[0] + 1.4, bh), 1).arm("near", hand, 1)
    _feet(top, ank)
    bot = Fig(hip_b, th_b, head_off=-4)
    bot.arm("far", (hand[0] + 1.4, bh), -1, upper=12.5).arm("near", hand, -1, upper=12.5)
    _feet(bot, ank)
    c.figure(top, "ghost")
    c.figure(bot, "solid", hi={("near", "arm", 1)})
    c.floor(-6, sh_b[0] + 16)
    return c.svg(scale, label="Deficit push-up")


def pseudo_planche(scale=S):
    c = Canvas()
    ank = (0.0, 3.6)
    th, hip, sh = _plank_line(ank, 28.6)
    reach = 30.8
    hand = (sh[0] - math.sqrt(reach ** 2 - sh[1] ** 2), 0.0)
    f = Fig(hip, th, head_off=-6)
    f.arm("far", (hand[0] + 1.2, 0), 1).arm("near", hand, 1, tip=(hand[0] - 5.5, 0.4))
    _feet(f, ank)
    c.figure(f, "solid", hi={("near", "arm", 1)})
    c.floor(-6, sh[0] + 16)
    return c.svg(scale, label="Pseudo-planche push-up")


def plyo_push_up(scale=S):
    c = Canvas()
    ank = (0.0, 3.6)
    th_b, hip_b, sh_b = _plank_line(ank, 12.0)
    th_t, hip_t, sh_t = _plank_line(ank, 38.0)
    hand_b = (_plank_line(ank, 31.5)[2][0] - 2.6, 0.0)
    bot = Fig(hip_b, th_b, head_off=-4)
    bot.arm("far", (hand_b[0] + 1.4, 0), -1, upper=12.5).arm("near", hand_b, -1, upper=12.5)
    _feet(bot, ank)
    top = Fig(hip_t, th_t, head_off=-4)
    air = (sh_t[0] - 2.0, sh_t[1] - 30.6)
    top.arm("far", (air[0] + 1.4, air[1]), 1).arm("near", air, 1)
    _feet(top, ank)
    c.figure(bot, "ghost")
    c.figure(top, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    c.straight_arrow((air[0] + 9, 2.0), (air[0] + 9, 9.5))
    c.floor(-6, sh_t[0] + 16)
    return c.svg(scale, label="Plyo push-up")


def archer_front(scale=S):
    """Front view, low position over the working (right) arm."""
    c = Canvas()
    sh_r, sh_l = (16.0, 13.0), (-5.0, 15.0)
    head = (6.5, 16.5)
    hand_r = (21.0, 0.0)
    hand_l = (-34.5, 0.0)
    j, e = ik(sh_r, hand_r, 12.5, FORE, -1)
    c.line(sh_r, j, HI, 6.6, 9)
    c.line(j, e, INK, 6.6, 9.1)
    j2, e2 = ik(sh_l, hand_l, UPPER, FORE, 1)
    c.line(sh_l, j2, INK, 6.6, 9)
    c.line(j2, e2, INK, 6.6, 9.1)
    c.line(sh_l, sh_r, INK, 8.6, 10)
    c.circle(head, HEAD_R, INK, 11)
    c.floor(-42, 32)
    return c.svg(scale, label="Archer push-up set forfra")


def pike_push_up(scale=S):
    c = Canvas()
    ank = (0.0, 3.6)
    hand = (60.0, 0.0)
    hip_t = (20.0, 46.0)
    u = ((hand[0] - hip_t[0]), (hand[1] - hip_t[1]))
    L = math.hypot(*u)
    u = (u[0] / L, u[1] / L)
    sh_t = (hip_t[0] + TORSO * u[0], hip_t[1] + TORSO * u[1])
    top = Fig(hip_t, 0, shoulder=sh_t, head=(sh_t[0] + 10.5 * u[0], sh_t[1] + 10.5 * u[1]))
    top.arm("far", (hand[0] + 1.2, 0), 1).arm("near", hand, 1)
    top.leg("far", (ank[0] - 1.2, ank[1]), 1, foot=(2.2, 0.3)).leg("near", ank, 1, foot=(3.4, 0.3))
    hip_b = (39.3, 29.3)
    head_b = (70.5, 6.7)
    v = (head_b[0] - hip_b[0], head_b[1] - hip_b[1])
    Lv = math.hypot(*v)
    v = (v[0] / Lv, v[1] / Lv)
    sh_b = (hip_b[0] + TORSO * v[0], hip_b[1] + TORSO * v[1])
    bot = Fig(hip_b, 0, shoulder=sh_b, head=head_b)
    bot.arm("far", (hand[0] + 1.2, 0), -1, upper=12.0).arm("near", hand, -1, upper=12.0)
    bot.leg("far", (ank[0] - 1.2, ank[1]), 1, foot=(2.2, 0.3)).leg("near", ank, 1, foot=(3.4, 0.3))
    c.figure(top, "ghost")
    c.figure(bot, "solid", hi={("near", "arm", 1)})
    c.floor(-6, 80)
    return c.svg(scale, label="Pike push-up")


def elevated_pike(scale=S):
    c = Canvas()
    c.chair(0, 24, 23)
    ank = (15.0, 26.6)
    hand = (50.0, 0.0)
    hip = (45.6, 60.5)
    u = (hand[0] - hip[0], hand[1] - hip[1])
    L = math.hypot(*u)
    u = (u[0] / L, u[1] / L)
    sh = (hip[0] + TORSO * u[0], hip[1] + TORSO * u[1])
    f = Fig(hip, 0, shoulder=sh, head=(sh[0] + 10.5 * u[0] + 1.0, sh[1] + 10.5 * u[1]))
    f.arm("far", (hand[0] + 1.2, 0), 1).arm("near", hand, 1)
    f.leg("far", (ank[0] - 1.2, ank[1]), 1, foot=(ank[0] + 1.8, 23.3))
    f.leg("near", ank, 1, foot=(ank[0] + 3.0, 23.3))
    c.figure(f, "solid", hi={("near", "arm", 1)})
    c.floor(-4, 62)
    return c.svg(scale, label="Pike push-up med fødderne på en stol")


def wall_handstand(scale=S):
    """Chest to wall: face toward the wall, toes touch the wall."""
    c = Canvas()
    wx = 30.0
    c.wall(wx, 0, 120, side=+1)
    hand = (wx - 9.0, 0.0)
    sh = (wx - 7.6, 31.0)
    hip = (wx - 5.4, 60.9)
    f = Fig(hip, 0, shoulder=sh)
    f.head = _add(sh, 10.5, _ang(hip, sh) + 8)
    f.arm("far", (hand[0] - 1.2, 0), 1).arm("near", hand, 1)
    ank_n, ank_f = (wx - 3.6, 107.3), (wx - 4.0, 106.8)
    f.leg("far", ank_f, -1, foot=(wx - 0.9, 113.8))
    f.leg("near", ank_n, -1, foot=(wx - 0.9, 114.4))
    c.figure(f, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    c.floor(4, wx)
    return c.svg(scale, label="Håndstand med maven mod væggen")


def hspu(scale=S):
    """Back to wall, head to a pillow. Ghost = top, solid = bottom."""
    c = Canvas()
    c.wall(0, 0, 118, side=-1)
    c.pillow(14.5, 15)
    hand = (11.0, 0.0)
    sh_t, hip_t = (12.4, 31.0), (5.0, 60.1)
    top = Fig(hip_t, 0, shoulder=sh_t)
    top.head = _add(sh_t, 10.5, _ang(hip_t, sh_t) - 4)
    top.arm("far", (hand[0] + 1.2, 0), 1).arm("near", hand, 1)
    top.leg("far", (4.6, 106.4), 1, foot=(5.6, 113.6)).leg("near", (4.4, 106.9), 1, foot=(5.4, 114.2))
    sh_b, hip_b = (17.0, 19.2), (5.2, 46.8)
    bot = Fig(hip_b, 0, shoulder=sh_b, head=(22.6, 10.4))
    bot.arm("far", (hand[0] + 1.2, 0), -1, upper=12.0).arm("near", hand, -1, upper=12.0)
    bot.leg("far", (4.6, 93.1), 1, foot=(5.6, 100.3)).leg("near", (4.4, 93.6), 1, foot=(5.4, 100.9))
    c.figure(top, "ghost")
    c.figure(bot, "solid", hi={("near", "arm", 1)})
    c.floor(0, 40)
    return c.svg(scale, label="Håndstands-push-up med ryggen mod væggen")


# ---------------------------------------------------------------- pull family
def table_row(scale=S):
    c = Canvas()
    edge, top_y = 40.0, 37.0
    c.rect(edge, top_y - 3.2, 44, 3.2, rx=1.2)
    c.line((edge + 40, 0), (edge + 40, top_y - 3.2), PROP_LINE, 2.4, z=0, cap="butt")
    c.line((edge + 36, 0), (edge + 36, top_y - 3.2), PROP_LINE, 2.4, z=0, cap="butt")
    grip = (edge + 1.0, top_y - 1.0)
    heel = (-26.3, 2.6)
    th_t = math.degrees(math.asin((26.0 - heel[1]) / BODY))
    sh_t = _add(heel, BODY, th_t)
    hip_t = _add(heel, LEG, th_t)
    th_b = math.degrees(math.asin((7.2 - heel[1]) / BODY))
    sh_b = _add(heel, BODY, th_b)
    hip_b = _add(heel, LEG, th_b)
    top = Fig(hip_t, th_t, head_off=-14)
    top.arm("far", (grip[0] + 1.2, grip[1]), 1).arm("near", grip, 1)
    top.leg("far", (heel[0] - 1.0, heel[1]), -1, foot=(heel[0] + 1.0, 9.5))
    top.leg("near", heel, -1, foot=(heel[0] + 2.0, 10.0))
    bot = Fig(hip_b, th_b, head_off=-6)
    bot.arm("far", (grip[0] + 1.2, grip[1]), 1).arm("near", grip, 1)
    bot.leg("far", (heel[0] - 1.0, heel[1]), -1, foot=(heel[0] - 0.5, 10.0))
    bot.leg("near", heel, -1, foot=(heel[0] + 0.3, 10.2))
    c.figure(bot, "ghost")
    c.figure(top, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    c.floor(-34, edge + 46)
    return c.svg(scale, label="Bord-row")


def backpack_row(scale=S):
    c = Canvas()
    c.chair(66, 24, 24)
    hip = (30.0, 46.0)
    th = 15
    f = Fig(hip, th, head_off=-2)
    sh = f.sh
    f.arm("far", (70.0, 24.2), 1)
    f.arm("near", (37.0, 44.5), -1)
    f.leg("far", (45.0, 3.6), 1, foot=7)
    f.leg("near", (8.5, 3.6), 1, foot=(14.0, 0.3))
    g = Fig(hip, th, head_off=-2)
    g.arm("near", (sh[0] + 0.6, sh[1] - 30.9), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    c.backpack(37.5, 44.0)
    c.floor(0, 94)
    return c.svg(scale, label="Etarms rygsæk-row")


# ---------------------------------------------------------------- legs
def split_squat(scale=S):
    c = Canvas()
    c.pillow(-1.5, 14)
    front, rear = (33.0, 3.6), (-17.5, 6.0)
    hip_b = (9.5, 27.0)
    f = Fig(hip_b, 89, head_off=0)
    f.arm("far", (hip_b[0] + 2.0, hip_b[1] - 0.5), 1).arm("near", (hip_b[0] + 3.0, hip_b[1] - 1.0), 1)
    f.leg("far", rear, 1, foot=(rear[0] - 5.5, 0.3))
    f.leg("near", front, 1, foot=(front[0] + 7.2, 0.3))
    hip_t = (9.0, 46.4)
    g = Fig(hip_t, 90)
    g.leg("far", rear, 1).leg("near", front, 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(-26, 46)
    return c.svg(scale, label="Split squat")


def bulgarian(scale=S):
    c = Canvas()
    c.chair(-44, 24, 23)
    rear = (-25.0, 25.2)
    front = (34.0, 3.6)
    hip = (10.0, 27.5)
    f = Fig(hip, 82, head_off=2)
    f.arm("far", (hip[0] + 4.0, hip[1] + 1.0), 1).arm("near", (hip[0] + 5.0, hip[1] + 0.5), 1)
    f.leg("far", rear, 1, foot=(rear[0] - 7.0, 23.4))
    f.leg("near", front, 1, foot=(front[0] + 7.2, 0.3))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(-46, 48)
    return c.svg(scale, label="Bulgarsk split squat")


def pistol(scale=S):
    c = Canvas()
    ank = (0.0, 3.6)
    hip = (-7.0, 14.5)
    f = Fig(hip, 58, head_off=-4)
    f.arm("far", (f.sh[0] + 30.0, f.sh[1] + 2.0), 1).arm("near", (f.sh[0] + 30.5, f.sh[1] + 0.5), 1)
    f.leg("far", _add(hip, LEG - 0.2, -1), 1, foot=80)
    f.leg("near", ank, 1, foot=(ank[0] + 7.2, 0.3))
    g = Fig((0.0, 47.0), 90)
    g.leg("near", ank, 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(-16, 50)
    return c.svg(scale, label="Pistol squat")


def wall_sit(scale=S, punch=True):
    c = Canvas()
    c.wall(0, 0, 80, side=-1)
    hip = (4.6, 27.0)
    f = Fig(hip, 90, head_off=0)
    f.head = (f.sh[0] + 1.4, f.sh[1] + NECK)
    f.arm("far", (f.sh[0] + 9.0, f.sh[1] + 9.5), -1, upper=13.0)
    if punch:
        f.arm("near", (f.sh[0] + 30.5, f.sh[1] + 4.0), 1)
    else:
        f.arm("near", (f.sh[0] + 9.5, f.sh[1] + 9.0), -1, upper=13.0)
    f.leg("far", (27.6, 3.6), 1, foot=(34.4, 0.3)).leg("near", (28.6, 3.6), 1, foot=(35.4, 0.3))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(0, 46)
    return c.svg(scale, label="Wall sit med garde og lige slag")


def sl_rdl(scale=S, backpack=True):
    c = Canvas()
    hip = (0.0, 45.5)
    f = Fig(hip, 4, head_off=-2)
    hand = (f.sh[0] + 0.8, f.sh[1] - 30.6)
    f.arm("far", (hand[0] + 1.0, hand[1]), 1).arm("near", hand, 1)
    f.leg("far", _add(hip, LEG - 0.1, 183), 1, foot=-87)
    f.leg("near", (3.0, 3.6), 1, foot=(10.2, 0.3))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    if backpack:
        c.backpack(hand[0] + 0.5, hand[1])
    c.floor(-10, 44)
    return c.svg(scale, label="Etbens rumænsk dødløft")


def calf_raise(scale=S):
    c = Canvas()
    c.rect(-2, 0, 30, 9, rx=1.2)
    hip = (4.0, 59.0)
    f = Fig(hip, 90)
    f.arm("far", (hip[0] + 1.0, hip[1] - 1.0), 1).arm("near", (hip[0] + 2.0, hip[1] - 1.5), 1)
    f.leg("near", (4.0, 15.8), 1, foot=(9.2, 9.3))
    f.leg("far", _add(hip, LEG - 1.0, -96), 1, foot=-30)
    c.figure(f, "solid", hi={("near", "leg", 2)})
    c.floor(-6, 34)
    return c.svg(scale, label="Etbens tåløft på trappetrin")


# ---------------------------------------------------------------- posterior chain
def hip_bridge(scale=S, single=True):
    c = Canvas()
    sh = (0.0, 4.6)
    head = (-10.5, HEAD_R + 0.3)
    hip = _add(sh, TORSO, 37)
    f = Fig(hip, 0, shoulder=sh, head=head)
    f.arm("far", (29.5, 1.6), 1).arm("near", (30.5, 1.2), 1)
    f.leg("near", (44.5, 3.6), 1, foot=(51.5, 0.3))
    if single:
        knee = f.limbs[-1][3]
        d = _ang(hip, knee)
        f.leg("far", _add(hip, LEG - 0.1, d), 1, foot=d + 85)
    else:
        f.leg("far", (45.5, 3.6), 1, foot=(52.5, 0.3))
    g = Fig(_add(sh, TORSO, 2), 0, shoulder=sh, head=head)
    g.leg("near", (44.5, 3.6), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1), ("torso",)})
    c.floor(-18, 72)
    return c.svg(scale, label="Etbens hoftebro")


def leg_curl(scale=S):
    c = Canvas()
    sh = (0.0, 4.6)
    head = (-10.5, HEAD_R + 0.3)
    heel_in = (44.0, 3.6)
    hip = (24.0, 19.5)
    f = Fig(hip, 0, shoulder=sh, head=head)
    f.arm("far", (29.5, 1.6), 1).arm("near", (30.5, 1.2), 1)
    f.leg("far", (heel_in[0] + 1.0, heel_in[1]), 1, foot=58).leg("near", heel_in, 1, foot=58)
    hip_g = (29.3, 10.6)
    heel_out = (hip_g[0] + math.sqrt(LEG ** 2 - (hip_g[1] - 3.6) ** 2) - 0.1, 3.6)
    g = Fig(hip_g, 0, shoulder=sh, head=head)
    g.leg("near", heel_out, 1, foot=82)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.towel(heel_in[0] - 5, 11)
    c.straight_arrow((heel_out[0] - 4, -5.0), (heel_in[0] + 7, -5.0))
    c.floor(-18, heel_out[0] + 8)
    return c.svg(scale, label="Glidende leg curl")


def nordic(scale=S):
    c = Canvas()
    c.couch(-66, -16, h=19, back=34, side_low=7.5)
    c.pillow(-6, 12)
    knee = (0.0, 5.8)
    ankle = (-23.0, 5.4)
    ang = 44
    hip = _add(knee, THIGH, ang)
    f = Fig(hip, ang, head_off=6)
    f.arm("far", _add(f.sh, 21, -30), -1).arm("near", _add(f.sh, 21, -34), -1)
    f.leg("far", (ankle[0] - 0.8, ankle[1]), 1, foot=(ankle[0] - 7.2, 7.4))
    f.leg("near", ankle, 1, foot=(ankle[0] - 7.4, 7.0))
    g = Fig(_add(knee, THIGH, 90), 90)
    g.leg("near", ankle, 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.arc_arrow(knee, 78, 82, 52)
    c.floor(-68, 66)
    return c.svg(scale, label="Nordic curl")


# ---------------------------------------------------------------- core
def hollow(scale=S):
    c = Canvas()
    hip = (0.0, 5.0)
    sh = _add(hip, TORSO, 166)
    f = Fig(hip, 0, shoulder=sh)
    f.head = _add(sh, 10.5, 156)
    f.arm("far", _add(sh, 30.8, 173), 1).arm("near", _add(sh, 30.8, 171), 1)
    f.leg("far", _add(hip, LEG - 0.1, 15), 1, foot=6).leg("near", _add(hip, LEG - 0.1, 13), 1, foot=4)
    c.figure(f, "solid", hi={("torso",)})
    c.floor(-66, 56)
    return c.svg(scale, label="Hollow hold")


def dead_bug(scale=S):
    c = Canvas()
    hip = (0.0, 4.8)
    sh = (-30.0, 4.8)
    f = Fig(hip, 0, shoulder=sh, head=(-40.5, HEAD_R + 0.4))
    f.arm("far", (-29.5, 35.6), 1)
    f.arm("near", _add(sh, 30.8, 174), 1)
    f.leg("far", (23.0, 28.8), 1, foot=(30.0, 28.8))
    f.leg("near", _add(hip, LEG - 0.1, 9), 1, foot=12)
    c.figure(f, "solid", hi={("torso",)})
    c.floor(-70, 54)
    return c.svg(scale, label="Dead bug")


def plank(scale=S, long_lever=False):
    c = Canvas()
    if long_lever:
        sh = (0.0, 15.0)
        elbow = (sh[0] + math.sqrt(16 ** 2 - (15.0 - 3.0) ** 2), 3.0)
    else:
        sh = (0.0, 19.0)
        elbow = (0.0, 3.0)
    run = math.sqrt(BODY ** 2 - (sh[1] - 3.6) ** 2)
    ank = (sh[0] - run, 3.6)
    th = _ang(ank, sh)
    hip = _add(ank, LEG, th)
    f = Fig(hip, th, head_off=-6)
    f.limbs.append(("far", "arm", sh, (elbow[0] + 1.2, elbow[1]), (elbow[0] + 15.0, 2.6), None))
    f.limbs.append(("near", "arm", sh, elbow, (elbow[0] + 14.0, 2.4), None))
    _feet(f, ank)
    c.figure(f, "solid", hi={("torso",)})
    c.floor(ank[0] - 6, elbow[0] + 20)
    return c.svg(scale, label="Long-lever planke" if long_lever else "RKC-planke")


def two_point_plank(scale=S):
    c = Canvas()
    sh = (0.0, 19.0)
    elbow = (0.0, 3.0)
    run = math.sqrt(BODY ** 2 - (sh[1] - 3.6) ** 2)
    ank = (sh[0] - run, 3.6)
    th = _ang(ank, sh)
    hip = _add(ank, LEG, th)
    f = Fig(hip, th, head_off=-6)
    f.arm("far", _add(sh, 30.8, 4), 1)
    f.limbs.append(("near", "arm", sh, elbow, (elbow[0] + 14.0, 2.4), None))
    f.leg("far", ank, 1, foot=(ank[0] + 3.4, 0.3))
    f.leg("near", _add(hip, LEG - 0.1, th + 180 - 13), 1, foot=th + 180 - 13 - 92)
    c.figure(f, "solid", hi={("torso",), ("near", "leg", 1)})
    c.floor(ank[0] - 6, 40)
    return c.svg(scale, label="2-punkts planke")


def side_plank(scale=S, star=False, straight_arm=False):
    """Front view of a side plank. Bottom leg pale, top leg navy."""
    c = Canvas()
    sh = (0.0, 30.8) if straight_arm else (0.0, 18.6)
    run = math.sqrt(BODY ** 2 - (sh[1] - 3.6) ** 2)
    ank = (sh[0] - run, 3.6)
    th = _ang(ank, sh)
    hip = _add(ank, LEG, th)
    nrm = th + 90
    f = Fig(hip, th, head_off=4)
    if straight_arm:
        f.limbs.append(("near", "arm", sh, (0.0, 15.6), (0.0, 0.4), None))
    else:
        f.limbs.append(("near", "arm", sh, (0.0, 2.6), (5.0, 2.4), None))
    f.leg("far", ank, 1, foot=(ank[0] - 1.6, 0.3))
    if star:
        f.arm("near", (sh[0] + 0.6, sh[1] + 30.8), 1)
        top = th + 180 - 30
        f.leg("near", _add(hip, LEG - 0.1, top), 1, foot=top - 70)
    else:
        el = _add(_add(hip, 15.0, th), 5.4, nrm)
        hd = _add(_add(hip, 1.0, th), 5.6, nrm)
        f.limbs.append(("near", "arm", sh, el, hd, None))
        top_ank = _add(ank, 6.2, nrm)
        f.leg("near", top_ank, 1, foot=_add(top_ank, 3.6, th + 180 + 70))
    c.figure(f, "solid", hi={("torso",)})
    c.floor(ank[0] - 6, 14)
    return c.svg(scale, label="Stjerne-sideplanke" if star else "Sideplanke")


def copenhagen(scale=S, long=True):
    """Front view. Top leg rests on a bench, bottom leg hangs free."""
    c = Canvas()
    bx, bw, bh = -30.0, 22.0, 26.0
    c.box(bx, 0, bw, bh)
    sh_y = 18.6
    if long:
        anchor = (bx + bw - 7.0, bh + 3.4)
        L = BODY
    else:
        anchor = (bx + bw - 3.0, bh + 4.4)
        L = THIGH + TORSO
    sh = (anchor[0] + math.sqrt(L ** 2 - (anchor[1] - sh_y) ** 2), sh_y)
    th = _ang(anchor, sh)
    hip = _add(anchor, LEG if long else THIGH, th)
    nrm = th + 90
    f = Fig(hip, th, head_off=4)
    f.limbs.append(("near", "arm", sh, (sh[0], 2.6), (sh[0] + 5.0, 2.4), None))
    el = _add(_add(hip, 15.0, th), 5.4, nrm)
    hd = _add(_add(hip, 1.0, th), 5.6, nrm)
    f.limbs.append(("near", "arm", sh, el, hd, None))
    if long:
        f.leg("near", anchor, 1, foot=(anchor[0] - 2.2, anchor[1] + 5.8))
    else:
        f.limbs.append(("near", "leg", hip, anchor, (anchor[0] - 21.5, anchor[1] - 0.6),
                        (anchor[0] - 24.5, anchor[1] + 5.4)))
    f.leg("far", (hip[0] - 33.0, 8.0), 1, foot=(hip[0] - 36.0, 1.5))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(bx - 4, sh[0] + 12)
    return c.svg(scale, label="Lang Copenhagen-planke" if long else "Kort Copenhagen-planke")


def side_adduction(scale=S):
    c = Canvas()
    hip = (0.0, 5.0)
    sh = (-30.0, 6.5)
    f = Fig(hip, 0, shoulder=sh, head=(-41.0, 9.5))
    f.limbs.append(("near", "arm", sh, (-30.0, 0.8), (-22.0, 0.8), None))
    f.arm("near", (-12.0, 4.0), -1, upper=14.0)
    f.leg("far", (18.0, 3.6), 1, foot=(24.0, 0.3))
    f.leg("near", _add(hip, LEG - 0.1, 14), 1, foot=18)
    g = Fig(hip, 0, shoulder=sh, head=(-41.0, 9.5))
    g.leg("near", _add(hip, LEG - 0.1, 1), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(-50, 52)
    return c.svg(scale, label="Liggende adduktorløft")


def reverse_crunch(scale=S):
    c = Canvas()
    sh = (-30.0, 4.6)
    head = (-40.5, HEAD_R + 0.4)
    hip = (0.0, 8.0)
    f = Fig(hip, 0, shoulder=sh, head=head)
    f.limbs.append(("far", "arm", sh, (-15.0, 1.6), (0.5, 1.6), None))
    f.limbs.append(("near", "arm", sh, (-14.0, 1.2), (1.5, 1.2), None))
    knee = _add(hip, THIGH, 114)
    ank = _add(knee, SHIN, 6)
    f.limbs.append(("far", "leg", hip, (knee[0] + 1.0, knee[1]), (ank[0] + 1.0, ank[1]), None))
    f.limbs.append(("near", "leg", hip, knee, ank, _add(ank, 6.0, 30)))
    g = Fig((0.0, 4.8), 0, shoulder=sh, head=head)
    k0 = (0.0, 4.8 + THIGH)
    g.limbs.append(("near", "leg", (0.0, 4.8), k0, (k0[0] + SHIN, k0[1]), None))
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("torso",)})
    c.floor(-50, 30)
    return c.svg(scale, label="Omvendt crunch")


def sit_up(scale=S, elbows=False):
    c = Canvas()
    hip = (0.0, 5.0)
    feet = (37.0, 3.6)
    ang = 62
    f = Fig(hip, ang, head_off=-6)
    if elbows:
        f.arm("far", (f.sh[0] + 9.0, f.sh[1] + 9.0), -1, upper=13.0)
        f.arm("near", (f.sh[0] + 15.0, f.sh[1] - 4.0), 1, upper=13.5)
    else:
        f.arm("far", (f.sh[0] + 8.0, f.sh[1] - 6.0), -1, upper=12.5)
        f.arm("near", (f.sh[0] + 9.0, f.sh[1] - 7.0), -1, upper=12.5)
    f.leg("far", (feet[0] - 1.0, feet[1]), 1, foot=(feet[0] + 6.0, 0.3))
    f.leg("near", feet, 1, foot=(feet[0] + 7.2, 0.3))
    g = Fig(hip, 178)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("torso",)})
    c.arc_arrow(hip, 40, 150, 104)
    c.floor(-44, 50)
    return c.svg(scale, label="Strikt sit-up")


def v_up(scale=S):
    c = Canvas()
    hip = (0.0, 5.0)
    f = Fig(hip, 128, head_off=6)
    f.arm("far", _add(f.sh, 30.8, 47), 1).arm("near", _add(f.sh, 30.8, 45), 1)
    f.leg("far", _add(hip, LEG - 0.1, 54), 1, foot=60).leg("near", _add(hip, LEG - 0.1, 52), 1, foot=58)
    c.figure(f, "solid", hi={("torso",)})
    c.floor(-30, 34)
    return c.svg(scale, label="V-up")


def dragon_flag(scale=S):
    c = Canvas()
    c.couch(-66, -22, h=19, back=34, side_low=7.5)
    sh = (0.0, 4.6)
    head = (-10.5, HEAD_R + 0.3)
    ang = 36
    hip = _add(sh, TORSO, ang)
    f = Fig(hip, 0, shoulder=sh, head=head)
    f.arm("far", (-21.6, 9.5), -1, upper=14.0).arm("near", (-22.4, 8.6), -1, upper=14.0)
    f.leg("far", _add(hip, LEG - 0.1, ang + 1), 1, foot=ang + 6).leg("near", _add(hip, LEG - 0.1, ang), 1, foot=ang + 5)
    g = Fig(_add(sh, TORSO, 80), 0, shoulder=sh, head=head)
    g.leg("near", _add(g.hip, LEG - 0.1, 81), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("torso",)})
    c.arc_arrow(sh, 84, 78, 44)
    c.floor(-68, 82)
    return c.svg(scale, label="Dragon flag")


# ---------------------------------------------------------------- power / burpee
def _stand(x=0.0):
    hip = (x, 50.4)
    f = Fig(hip, 90)
    f.arm("far", (x + 1.0, 46.2), 1).arm("near", (x + 2.0, 45.8), 1)
    f.leg("far", (x - 1.2, 3.6), 1, foot=(x + 6.0, 0.3)).leg("near", (x + 1.2, 3.6), 1, foot=(x + 8.4, 0.3))
    return f


def burpee_strip(scale=S):
    c = Canvas()
    gap = 50.0
    c.figure(_stand(0.0), "solid")
    x = gap
    hip = (x - 5.0, 19.0)
    f = Fig(hip, 50, head_off=-8)
    f.arm("far", (x + 15.0, 0.0), 1).arm("near", (x + 16.2, 0.0), 1)
    f.leg("far", (x - 1.2, 3.6), 1, foot=(x + 6.0, 0.3)).leg("near", (x + 1.2, 3.6), 1, foot=(x + 8.4, 0.3))
    c.figure(f, "solid")
    x = gap * 2 - 4
    ank = (x, 3.6)
    th, hp, sh = _plank_line(ank, 9.4)
    hand = (sh[0] - 6.0, 0.0)
    g = Fig(hp, th, head_off=-4)
    g.arm("far", (hand[0] + 1.4, 0), -1, upper=12.5).arm("near", hand, -1, upper=12.5)
    _feet(g, ank)
    c.figure(g, "solid", hi={("torso",)})
    x = gap * 2 + 98
    j = Fig((x, 58.0), 90)
    j.arm("far", (x + 2.5, 118.6), 1).arm("near", (x + 4.0, 118.4), 1)
    j.leg("far", (x - 1.0, 14.4), 1, foot=-78).leg("near", (x + 1.0, 14.0), 1, foot=-76)
    c.figure(j, "solid", hi={("near", "leg", 1)})
    c.floor(-10, x + 12)
    for xa in (24.0, 74.0, x - 18.0):
        c.straight_arrow((xa - 6, 64), (xa + 6, 64))
    return c.svg(scale, label="Burpee i fire trin")


def squat_jump(scale=S):
    c = Canvas()
    hip = (-7.0, 23.0)
    f = Fig(hip, 62, head_off=-6)
    f.arm("far", (f.sh[0] - 10.0, f.sh[1] - 26.0), 1).arm("near", (f.sh[0] - 9.0, f.sh[1] - 27.0), 1)
    f.leg("far", (-1.2, 3.6), 1, foot=(6.0, 0.3)).leg("near", (1.2, 3.6), 1, foot=(8.4, 0.3))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    x = 50.0
    j = Fig((x, 60.0), 90)
    j.arm("far", (x + 2.5, 120.6), 1).arm("near", (x + 4.0, 120.4), 1)
    j.leg("far", (x - 1.0, 16.4), 1, foot=-78).leg("near", (x + 1.0, 16.0), 1, foot=-76)
    c.figure(j, "solid")
    c.straight_arrow((22, 58), (34, 72))
    c.floor(-20, 64)
    return c.svg(scale, label="Squat jump")


def skater(scale=S):
    """Front view: landing on one leg after a sideways bound."""
    c = Canvas()
    pel_l, pel_r = (-5.5, 39.0), (5.5, 37.0)
    sh_l, sh_r = (-9.0, 67.0), (11.0, 64.0)
    c.poly([pel_l, pel_r, sh_r, sh_l], INK, 6.6, z=9, fill=INK, close=True)
    c.circle((2.0, 76.0), HEAD_R, INK, 10)
    j, e = ik(pel_r, (9.0, 3.6), THIGH, SHIN, -1)
    c.line(pel_r, j, HI, 6.6, 11)
    c.line(j, e, INK, 6.6, 11.1)
    c.line(e, (e[0] + 4.0, 0.3), INK, 5.3, 11.1)
    j2, e2 = ik(pel_l, (12.0, 14.0), THIGH, SHIN, 1)
    c.line(pel_l, j2, FAR, 6.6, 8)
    c.line(j2, e2, FAR, 6.6, 8.1)
    c.line(sh_l, (-27.0, 52.0), INK, 6.6, 10.5)
    c.line(sh_r, (24.0, 76.0), INK, 6.6, 10.5)
    c.straight_arrow((-44, 30), (-20, 30))
    c.floor(-48, 30)
    return c.svg(scale, label="Skater-hop")


# ---------------------------------------------------------------- open & strong
def thoracic_ext(scale=S):
    c = Canvas()
    c.circle((0.0, 4.2), 4.2, "#F6E3E6", z=3, stroke="#E3B5BE", sw=1.0)
    hip = (-30.0, 5.0)
    sh = (0.5, 12.6)
    f = Fig(hip, 0, shoulder=sh, head=(10.6, 9.4))
    f.arm("far", (30.0, 6.0), 1).arm("near", (31.0, 5.0), 1)
    f.limbs.append(("far", "leg", hip, (-36.0, 26.0), (-50.0, 3.6), None))
    f.limbs.append(("near", "leg", hip, (-35.0, 26.0), (-49.0, 3.6), (-42.0, 0.6)))
    c.figure(f, "solid", hi={("torso",)})
    c.floor(-62, 46)
    return c.svg(scale, label="Brystryg over et sammenrullet håndklæde")


def open_book(scale=S):
    """Seen from above: lying on the side, knees bent, top arm opens."""
    c = Canvas()
    hip = (0.0, 0.0)
    sh = (30.0, 0.0)
    f = Fig(hip, 0, shoulder=sh, head=(41.0, 0.0))
    f.limbs.append(("far", "leg", hip, (0.0, 23.5), (-22.5, 23.5), None))
    f.limbs.append(("near", "leg", (0.5, -0.5), (1.5, 23.0), (-21.0, 22.5), None))
    f.limbs.append(("far", "arm", sh, (30.0, 16.0), (30.0, 30.8), None))
    g = Fig(hip, 0, shoulder=sh, head=(41.0, 0.0))
    g.limbs.append(("near", "arm", sh, (31.5, 16.0), (31.5, 30.6), None))
    f.limbs.append(("near", "arm", sh, (30.6, -16.0), (31.4, -30.8), None))
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "arm", 1), ("near", "arm", 2)})
    c.arc_arrow(sh, 34.5, 72, -36)
    return c.svg(scale, label="Åben bog set ovenfra")


def prone_y(scale=S):
    c = Canvas()
    hip = (0.0, 5.0)
    sh = (30.0, 7.4)
    f = Fig(hip, 0, shoulder=sh, head=(40.6, 9.0))
    f.arm("far", _add(sh, 30.8, 17), 1).arm("near", _add(sh, 30.8, 15), 1)
    f.leg("far", (-46.5, 3.6), 1, foot=(-53.5, 1.8)).leg("near", (-46.0, 3.6), 1, foot=(-53.0, 1.6))
    g = Fig(hip, 0, shoulder=sh, head=(40.6, 9.0))
    g.arm("near", _add(sh, 30.8, 2), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid", hi={("near", "arm", 1)})
    c.floor(-58, 66)
    return c.svg(scale, label="Y-løft liggende på maven")


def chin_tuck(scale=S):
    c = Canvas()
    hip = (0.0, 0.0)
    sh = (0.0, 30.0)
    g = Fig(hip, 0, shoulder=sh, head=(6.8, 40.0))
    f = Fig(hip, 0, shoulder=sh, head=(0.8, 41.2))
    f.arm("near", (1.5, 2.0), 1)
    c.figure(g, "ghost")
    c.figure(f, "solid")
    c.straight_arrow((15.0, 47.5), (8.0, 47.5))
    return c.svg(scale, label="Hage-ind")


def couch_stretch(scale=S):
    c = Canvas()
    c.couch(-36, -3.5, h=19, back=40, side_low=7.5)
    c.pillow(-4.0, 11)
    knee = (1.0, 5.6)
    hip = (11.0, 27.4)
    f = Fig(hip, 91, head_off=0)
    f.arm("far", (25.0, 30.0), -1, upper=14.0).arm("near", (26.0, 29.0), -1, upper=14.0)
    f.leg("far", (36.0, 3.6), 1, foot=(43.2, 0.3))
    f.limbs.append(("near", "leg", hip, knee, (-1.6, 28.4), (-2.6, 35.6)))
    c.figure(f, "solid", hi={("near", "leg", 1)})
    c.floor(-38, 50)
    return c.svg(scale, label="Couch stretch")


def wall_slide(scale=S):
    c = Canvas()
    pl, pr = (-6.0, 47.0), (6.0, 47.0)
    sl, sr = (-11.0, 77.0), (11.0, 77.0)
    for hp, ft in ((pl, (-7.5, 3.6)), (pr, (7.5, 3.6))):
        mid = ((hp[0] + ft[0]) / 2, 25.3)
        c.line(hp, mid, INK, 6.6, 6)
        c.line(mid, ft, INK, 6.6, 6)
    c.poly([pl, pr, sr, sl], INK, 6.6, z=7, fill=INK, close=True)
    c.circle((0.0, 88.5), HEAD_R, INK, z=8)
    for s, sg in ((sl, -1), (sr, 1)):
        e = (s[0] + sg * 14.5, 75.0)
        c.line(s, e, GHOST, 6.6, 3)
        c.line(e, (e[0], 90.0), GHOST, 6.6, 3)
    for s, sg in ((sl, -1), (sr, 1)):
        e = (s[0] + sg * 9.5, 91.5)
        h = (s[0] + sg * 15.5, 105.8)
        c.line(s, e, HI, 6.6, 9)
        c.line(e, h, HI, 6.6, 9)
    c.floor(-30, 30)
    return c.svg(scale, label="Wall slides")


def neck_iso(scale=S):
    c = Canvas()
    hip = (0.0, 0.0)
    sh = (0.0, 30.0)
    f = Fig(hip, 0, shoulder=sh, head=(1.0, 41.2))
    f.arm("near", (7.6, 43.0), -1, upper=13.0, tip=(8.6, 47.0))
    c.figure(f, "solid", hi={("near", "arm", 2)})
    c.straight_arrow((18.0, 43.0), (10.0, 43.0))
    return c.svg(scale, label="Nakke-isometri")


# ---------------------------------------------------------------- muay thai figures
def teep(scale=S, mode="solid"):
    c = Canvas()
    hip = (0.0, 46.0)
    f = Fig(hip, 104, head_off=-10)
    f.arm("far", (f.sh[0] + 8.0, f.sh[1] + 9.5), -1, upper=13.0)
    f.arm("near", (f.sh[0] + 6.0, f.sh[1] + 11.0), -1, upper=13.0)
    f.leg("far", (-7.0, 3.6), 1, foot=(0.5, 0.3))
    f.leg("near", _add(hip, LEG - 0.1, 6), 1, foot=88)
    c.figure(f, mode)
    return c.svg(scale, label="Teep")


def knee_strike(scale=S, mode="solid"):
    """Clinch knee: hips forward, knee driven up, hands pulling down in front."""
    c = Canvas()
    hip = (0.0, 48.0)
    f = Fig(hip, 106, head_off=-16)
    sh = f.sh
    f.arm("far", (sh[0] + 25.0, sh[1] - 1.0), -1, upper=15.0)
    f.arm("near", (sh[0] + 23.0, sh[1] - 4.0), -1, upper=15.0)
    f.leg("far", (-7.0, 6.2), 1, foot=(-1.0, 0.3))
    knee = _add(hip, THIGH, 38)
    ank = _add(knee, SHIN, -112)
    f.limbs.append(("near", "leg", hip, knee, ank, _add(ank, 7.0, -98)))
    c.figure(f, mode)
    return c.svg(scale, label="Knæspark")


def flying_knee(scale=S, mode="solid"):
    c = Canvas()
    hip = (0.0, 62.0)
    f = Fig(hip, 100, head_off=-10)
    sh = f.sh
    f.arm("far", (sh[0] + 20.0, sh[1] + 10.0), -1, upper=15.0)
    f.arm("near", (sh[0] + 22.0, sh[1] + 6.0), -1, upper=15.0)
    knee = _add(hip, THIGH, 48)
    ank = _add(knee, SHIN, -118)
    f.limbs.append(("near", "leg", hip, knee, ank, _add(ank, 7.0, -100)))
    k2 = _add(hip, THIGH, -128)
    a2 = _add(k2, SHIN, -60)
    f.limbs.append(("far", "leg", hip, k2, a2, _add(a2, 7.0, -40)))
    c.figure(f, mode)
    return c.svg(scale, label="Flyvende knæ")


def guard_stance(scale=S, mode="solid"):
    """Muay Thai stance: upright, weight back, hands high."""
    c = Canvas()
    hip = (0.0, 48.6)
    f = Fig(hip, 92, head_off=-12)
    sh = f.sh
    f.arm("far", (sh[0] + 8.0, sh[1] + 10.5), -1, upper=13.0)
    f.arm("near", (sh[0] + 15.0, sh[1] + 11.0), -1, upper=14.0)
    f.leg("far", (-11.0, 6.4), 1, foot=(-5.0, 0.3))
    f.leg("near", (12.0, 3.6), 1, foot=(19.2, 0.3))
    c.figure(f, mode)
    return c.svg(scale, label="Kampstilling")


ALL = [
    ("push_up", push_up), ("one_arm_push_up", one_arm_push_up), ("deficit_push_up", deficit_push_up),
    ("pseudo_planche", pseudo_planche), ("plyo_push_up", plyo_push_up), ("archer_front", archer_front),
    ("pike_push_up", pike_push_up), ("elevated_pike", elevated_pike), ("wall_handstand", wall_handstand),
    ("hspu", hspu), ("table_row", table_row), ("backpack_row", backpack_row),
    ("split_squat", split_squat), ("bulgarian", bulgarian), ("pistol", pistol), ("wall_sit", wall_sit),
    ("sl_rdl", sl_rdl), ("calf_raise", calf_raise), ("hip_bridge", hip_bridge), ("leg_curl", leg_curl),
    ("nordic", nordic), ("hollow", hollow), ("dead_bug", dead_bug), ("plank", plank),
    ("long_lever", lambda s=S: plank(s, True)), ("two_point", two_point_plank),
    ("side_plank", side_plank), ("star_side", lambda s=S: side_plank(s, True)),
    ("star_side_arm", lambda s=S: side_plank(s, True, True)),
    ("copenhagen", copenhagen), ("copenhagen_short", lambda s=S: copenhagen(s, False)),
    ("side_adduction", side_adduction), ("reverse_crunch", reverse_crunch), ("sit_up", sit_up),
    ("sit_up_elbows", lambda s=S: sit_up(s, True)), ("v_up", v_up), ("dragon_flag", dragon_flag),
    ("burpee_strip", burpee_strip), ("squat_jump", squat_jump), ("skater", skater),
    ("thoracic_ext", thoracic_ext), ("open_book", open_book), ("prone_y", prone_y),
    ("chin_tuck", chin_tuck), ("couch_stretch", couch_stretch), ("wall_slide", wall_slide),
    ("neck_iso", neck_iso), ("teep", teep), ("knee_strike", knee_strike), ("flying_knee", flying_knee), ("guard_stance", guard_stance),
]
