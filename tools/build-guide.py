# -*- coding: utf-8 -*-
"""Build guide.html, the walkthrough of the site.

    python3 tools/build-guide.py

The wording of every page lives in this file, so the guide is edited here and rebuilt rather
than being hand-edited as HTML. The pictures it points at are made by tools/guide-shots.mjs.
Check the result with tools/guide-check.mjs.
"""
import io, html, json

def esc(s): return html.escape(s, quote=False)

# ---- block helpers -----------------------------------------------------------
def p(t): return f'<p>{t}</p>'
def lede(t): return f'<p class="lede">{t}</p>'
def steps(items):
    li = "".join(f'<li>{i}</li>' for i in items)
    return f'<ol class="steps">{li}</ol>'
def bullets(items):
    li = "".join(f'<li>{i}</li>' for i in items)
    return f'<ul class="bullets">{li}</ul>'
def note(t, kind="tip", title=None):
    heads = {"tip": "Worth knowing", "warn": "Be careful here", "important": "Important", "plain": "In plain words"}
    h = title or heads.get(kind, "")
    return f'<div class="note {kind}"><div class="note-h">{h}</div><div>{t}</div></div>'
def pic(name, caption, example=True):
    tag = '<span class="example-tag">Example numbers &mdash; yours will look different</span>' if example else ''
    return (f'<figure class="shot"><img src="guide/img/{name}.png" alt="{esc(caption)}" loading="lazy">'
            f'<figcaption>{caption} {tag}</figcaption></figure>')
def fields(rows):
    tr = "".join(f'<tr><th>{a}</th><td>{b}</td></tr>' for a, b in rows)
    return f'<table class="fields"><tbody>{tr}</tbody></table>'

S = []
def slide(section, title, blocks):
    S.append({"section": section, "title": title, "blocks": blocks})

# ============================ THE SLIDES =====================================
A = "Before you start"
slide(A, "How to use Silent Partner", [
    lede("A walk through every page of the site, in plain English. Nothing here is technical, and nothing you do while reading changes your books."),
    note("Press the big <strong>Next</strong> button at the bottom of the screen, or use the <strong>&rarr;</strong> arrow key on your keyboard. "
         "You can stop whenever you like and come back later &mdash; it remembers the page you were on. "
         "To jump straight to something, press <strong>All the steps</strong> at the top.", "plain", "How to move through this"),
    p("There are 28 short pages. Reading all of them takes about fifteen minutes."),
])
slide(A, "What this site is for", [
    lede("It keeps track of the shop&rsquo;s money all year, so that &ldquo;how much can we spend, or give away?&rdquo; takes a minute instead of a week."),
    p("It watches the bank balance, the bills that are coming, and what the shop usually takes in. From those it works out one number: what is genuinely safe to spend today."),
    note("Think of it as a careful assistant who has read every bill, never forgets one, and will always show you their working.", "plain"),
    p("<strong>It is not a bookkeeping program.</strong> It will not do your taxes, run payroll, or send invoices. You still need whatever you already use for those."),
])
slide(A, "Three things it will never do", [
    lede("This matters more than any feature, so it comes first."),
    bullets([
        "<strong>It never moves money.</strong> It cannot reach your bank. It only reads what you type in.",
        "<strong>It never sends anything.</strong> The weekly update is text you copy and send yourself, if you want to.",
        "<strong>It never decides.</strong> It recommends, and it pushes back when something looks risky. Every decision stays yours.",
    ]),
    note("Every figure it shows can be traced back to something you typed. If a number ever looks wrong, there is a line of working you can read, and it is on the home page.", "tip"),
])
slide(A, "Your first twenty minutes", [
    lede("Do these five things, in this order. After the second one, the big number on the home page starts being real."),
    steps([
        "<strong>Set a password only you know.</strong> Covered on the next few pages.",
        "<strong>Type in your bank balance.</strong> This is the foundation; nothing works properly without it.",
        "<strong>Add the bills that come every month.</strong> Payroll, taxes, anything regular.",
        "<strong>Add the last few weeks of sales.</strong> Eight weeks is plenty.",
        "<strong>From then on, log expenses as they happen.</strong> A minute each.",
    ]),
    note("You do not have to do it all at once. The site is useful after step 2, and gets more accurate with each one after that.", "tip"),
])

B = "Opening it"
slide(B, "Unlocking the site", [
    lede("Everything in the shop&rsquo;s books is scrambled until the right password is typed in. That is what this screen is for."),
    pic("lock-screen", "The first thing you see.", example=False),
    steps(["Type the password into the box.", "Press <strong>Unlock</strong>."]),
    note("Capital letters and extra spaces do not matter. If it will not open, check the <strong>Caps Lock</strong> key first &mdash; that is the usual culprit.", "tip"),
    note("There is no &ldquo;forgot password&rdquo; button that can rescue you. If the password is lost, nobody can open the books &mdash; not the people who built this, not anyone. "
         "Write it down and keep it somewhere safe.", "warn"),
])
slide(B, "Make the password your own", [
    lede("The password you were given is known by several people. Before you type in real figures, change it to one only you know."),
    pic("banner-shared-password", "Until you do, this orange strip appears on every page.", example=False),
    steps([
        "Press <strong>Settings</strong> along the top.",
        "Find the box headed <strong>Privacy &amp; password</strong>.",
        "Type the password you were given into <em>Current password</em>.",
        "Type your new one into both of the next boxes.",
        "Press <strong>Change password</strong>.",
    ]),
    pic("settings-password", "Where to do it.", example=False),
    note("Choose a <strong>phrase</strong>, not a word. Four ordinary words you will remember are far safer than one clever word. "
         "Write it down and keep it where you keep important papers.", "important"),
    note("From that moment on, <strong>the password the link came with will not open your books any more</strong>. "
         "That is the whole point of changing it: a word several people know should not open your figures. "
         "If you ever type the old one out of habit, the site will say so and nothing at all will happen to your work.", "plain"),
])
slide(B, "It locks itself", [
    lede("If the site is left alone for fifteen minutes, it locks again on its own. That way the books are not sitting open on a screen in the shop."),
    pic("topbar", "The bar along the top. The Lock button is on the right.", example=False),
    bullets([
        "Press <strong>Lock</strong> whenever you walk away.",
        "Nothing is lost when it locks. Everything is saved the moment you type it.",
        "To get back in, type your password again.",
    ]),
])

C = "The home page"
slide(C, "The big number", [
    lede("This is the whole point of the site. It is the money left over after every bill it knows about, and after setting your cushion aside."),
    pic("home-hero", "The home page, at the top."),
    p("It is deliberately cautious. It has already taken off the bills you have not paid yet, the regular bills coming due, and the cushion you said you always want to keep."),
    note("If it says <strong>$0</strong>, that is not a fault. It means the bills it knows about use up everything above your cushion. "
         "The working on the next page will show you exactly which ones.", "tip"),
])
slide(C, "How it worked that number out", [
    lede("Scroll down the home page and every line of the arithmetic is written out. Nothing is hidden."),
    pic("home-math", "Every line, in order, with the total at the bottom."),
    fields([
        ("Money in the bank", "The last balance you typed in, with the date you typed it."),
        ("Spent since that balance", "Anything you have logged as paid since then."),
        ("Sales we expect", "Your recent weekly average, multiplied by how cautious you asked it to be."),
        ("Bills you haven&rsquo;t paid yet", "Every unpaid expense, listed by name."),
        ("Repeat bills coming due", "The regular ones falling inside your window."),
        ("Cushion", "The amount you said you always keep aside. Never counted as spendable."),
    ]),
    note("If a number ever surprises you, read this list. The answer is always in one of these lines.", "plain"),
])
slide(C, "Needs your OK", [
    lede("The site flags anything that looks like it needs a second glance. It never changes or deletes anything by itself &mdash; it only asks."),
    pic("home-needs-ok", "Three things waiting to be looked at."),
    p("There are three reasons something gets flagged:"),
    fields([
        ("Something is missing", "No amount, no date, or not marked paid or unpaid. Until it is complete, it is left out of the big number."),
        ("Possible duplicate", "The same supplier, the same amount, within a few days. Usually it is a real second order &mdash; but sometimes it is the same bill typed twice."),
        ("Big amount", "Anything over the figure you set in Settings. Just a &ldquo;was this right?&rdquo;"),
    ]),
    note("Press <strong>That&rsquo;s right</strong> and it stops asking. Press the expense itself to correct it.", "tip"),
])
slide(C, "Coming up", [
    lede("The bills heading towards you, soonest first, so nothing arrives as a surprise."),
    pic("home-coming-up", "What is due, and when."),
    bullets([
        "Anything <strong>overdue</strong> is marked in red.",
        "Anything due in the next week is marked in amber.",
        "This is the same list the big number has already set money aside for.",
    ]),
])

D = "Putting your numbers in"
slide(D, "Start here: money in the bank", [
    lede("This is the foundation. Until the site knows your bank balance, every other number is a guess."),
    pic("money-bank", "Under <strong>Bills &amp; sales</strong>."),
    steps([
        "Press <strong>Bills &amp; sales</strong> along the top.",
        "Look up the current balance on your bank&rsquo;s website or your last statement.",
        "Put the date that balance is from, and the amount.",
        "Press <strong>Save balance</strong>.",
    ]),
    note("Do this about once a week. The site counts everything you have logged as paid <em>since</em> that date, so it stays accurate in between &mdash; "
         "but a fresh balance is always better than a clever guess.", "tip"),
])
slide(D, "Weekly sales", [
    lede("So the site knows roughly what the shop takes in, and can allow for money still to come."),
    pic("money-sales", "One line per week."),
    steps([
        "Put in the week-ending date and what the shop took, after refunds.",
        "Press <strong>Save sales</strong>.",
        "Or, if your till can produce a spreadsheet, press <strong>Import sales</strong> and choose the file.",
    ]),
    note("It only ever counts a <em>portion</em> of expected sales &mdash; 60% unless you change it &mdash; because a good autumn is not a promise about December. "
         "You can change that under Settings.", "plain"),
])
slide(D, "Bills that repeat", [
    lede("Enter payroll, taxes and anything else regular once, and the site will keep setting money aside for them for ever."),
    pic("money-recurring", "Each one with its amount, when it is next due, and how often."),
    steps([
        "Give the bill a name you will recognise.",
        "Put in the amount and the next date it is due.",
        "Choose how often: monthly, quarterly or yearly.",
        "Press <strong>Add bill</strong>.",
    ]),
    note("This is the single most valuable thing you can set up. It is what stops the site telling you money is safe to spend when payroll is ten days away.", "important"),
])
slide(D, "Logging an expense", [
    lede("The everyday job. A minute each, whenever something is bought or a bill arrives."),
    pic("expense-form", "Under <strong>Expenses</strong>."),
    fields([
        ("Date", "When it happened."),
        ("Who was paid", "The supplier. Type a name you have used before and it will suggest the same category."),
        ("What it was for", "A few words for your own memory."),
        ("Category", "Which kind of spending it is."),
        ("Amount", "What it cost."),
        ("Paid or unpaid", "<strong>Paid</strong> means the money has gone. <strong>Unpaid</strong> means a bill you still owe &mdash; then give it a due date."),
    ]),
    note("If you paid a deposit and owe the rest, tick the deposit box. It will create the second half for you as an unpaid bill, so it is not forgotten.", "tip"),
])
slide(D, "The list of everything", [
    lede("Every expense, newest first, with anything needing attention marked."),
    pic("expense-list", "The full list."),
    bullets([
        "Use the dropdown to show only unpaid bills, or only things needing your OK.",
        "Press <strong>Mark paid</strong> when a bill is settled &mdash; the big number updates straight away.",
        "Press <strong>Edit</strong> to correct anything. Press <strong>Delete</strong> to remove it.",
    ]),
    note("Editing an expense makes the site look at it afresh, so it may ask you to confirm it again. That is deliberate.", "plain"),
])

E = "The questions it answers"
slide(E, "Can we afford it?", [
    lede("For when somebody asks for something specific and you need an answer you can defend."),
    pic("afford-form", "Type in the amount and what it is for."),
    steps([
        "Press <strong>Can we afford it?</strong> along the top.",
        "Type the amount, and a few words about what it is for.",
        "Press <strong>Check it</strong>.",
    ]),
])
slide(E, "...and the answer you get", [
    lede("Not just yes or no. It names the bills at risk and offers a middle option."),
    pic("afford-answer", "When the answer is no, it says why, and what it would do instead."),
    p("If it says hold off, it will tell you how far into your cushion the spending would dig, which bills are at risk, and a smaller figure that <em>would</em> be safe &mdash; and when to look again."),
    pic("afford-math", "Underneath the answer, the same working as on the home page."),
    note("If you need to show somebody <em>why</em> the answer is no, this is the part to show them. Every line of it came from something you typed in.", "tip"),
])
slide(E, "The Sports Club check", [
    lede("The big one. The Sports Club owns the shop, so the year-end payment is its share of the year &mdash; not a gift."),
    pic("club", "The year-end working, line by line."),
    p("Two things come off before the Club&rsquo;s share can be worked out:"),
    steps([
        "<strong>What the shop needs to open next season</strong> without borrowing. You type that figure in.",
        "<strong>The management checks</strong>, as a percentage of what is left.",
    ]),
    p("Whatever survives both is the Sports Club&rsquo;s check, and the working is shown so you can take it to a meeting."),
    note("This adds no new arithmetic. It starts from the same safe-to-spend figure as the home page, which has already covered every bill and held your cushion back.", "plain"),
])
slide(E, "Management checks", [
    lede("Splitting the management share between the people who get one."),
    pic("mgmt-split", "How much there is to divide."),
    pic("mgmt-people", "And who gets what."),
    bullets([
        "Leave the shares <strong>blank</strong> and the money is divided evenly.",
        "Or put in numbers to weight it. 60 and 40 divides it the same way 6 and 4 does &mdash; they do not have to add up to 100.",
    ]),
])
slide(E, "Are you charging enough?", [
    lede("Works out what something really costs to sell, including your own time, and whether the price covers it."),
    pic("pricing", "Fill in the boxes on the left; the answer appears as you type."),
    p("The important box is <strong>minutes of your time</strong>. Most small shops look profitable only because nobody is counting the owner&rsquo;s hours."),
    note("If an item only makes money when your time is free, it says so, in those words, and tells you what you lose on each one.", "important"),
])
slide(E, "The weekly update", [
    lede("A short, plain summary of where the shop stands, written for you to send to somebody else."),
    pic("update", "Ready to copy."),
    steps([
        "Press <strong>Weekly update</strong> along the top.",
        "Read it. Change any of the wording you like &mdash; it is just text.",
        "Press <strong>Copy</strong>, then paste it into an email or a text message.",
    ]),
    note("Nothing is ever sent for you. It goes no further than your clipboard until you send it yourself.", "important"),
])

F = "Looking after it"
slide(F, "Settings: your shop", [
    lede("The handful of figures that shape every calculation. They are already filled in with your answers &mdash; change them whenever they stop being true."),
    pic("settings-business", "Everything here affects the big number."),
    fields([
        ("Money always kept aside", "Your cushion. Never treated as spendable."),
        ("How far ahead to look", "Bills due inside this many days are set aside first. 90 days by default."),
        ("Count this % of expected sales", "Lower is more cautious."),
        ("Ask me to confirm expenses over", "Anything bigger gets flagged for a second look."),
        ("Categories", "Your own list of kinds of spending."),
    ]),
])
slide(F, "Keeping a copy", [
    lede("A backup is one file holding everything, locked with your password. Keep one somewhere safe."),
    pic("settings-data", "At the bottom of Settings."),
    bullets([
        "<strong>Download locked backup</strong> saves the file. It is safe to email to yourself &mdash; nobody can read it without your password.",
        "<strong>Restore backup</strong> puts one back. It will ask for the password that was in use when the backup was made.",
        "<strong>Download expenses</strong> gives you a plain spreadsheet for your accountant.",
    ]),
    note("The spreadsheet is <strong>not</strong> locked. Anyone who gets that file can read every line of it. The backup file is the safe one to send around.", "warn"),
])
slide(F, "Saving somewhere other than this computer", [
    lede("Optional, and switched off unless somebody sets it up for you."),
    pic("settings-sync", "The box at the bottom of Settings."),
    p("Normally the books live in this browser, on this computer. That is private, but it means that if the computer is replaced or the browser is cleared, they are gone."),
    p("Switched on, the site also keeps a locked copy in a private online store after every change. The books then survive the computer, and two people can work on them at once without losing each other&rsquo;s work."),
    note("What is stored online is the scrambled file and nothing else &mdash; not your password, and not a single readable figure. "
         "The site will refuse to switch this on until you have set a password of your own.", "plain"),
    note("Setting this up is a job for whoever looks after the site, not something you need to do yourself. Ask them for the printed instructions.", "tip"),
])
slide(F, "If something looks wrong", [
    lede("The usual causes, and what to do about them."),
    fields([
        ("The big number looks too low", "Read the working on the home page. Usually a large unpaid bill, or a repeat bill falling inside the window."),
        ("The big number says $0", "Your known bills use up everything above the cushion. The working will name them."),
        ("A number has not changed", "Check whether the expense is waiting under <strong>Needs your OK</strong>. Incomplete entries are left out until they are finished."),
        ("The password will not work", "Check Caps Lock. Capitals and spaces do not matter, but the letters do."),
        ("It says the password the link came with no longer works", "That is correct, and it is on purpose. Once you chose your own, that is the only one that opens your books. Nothing has been lost &mdash; type yours instead."),
        ("Does closing the page lose my work?", "No. Every entry is saved the moment you type it. Close the tab, shut the computer, come back next week: it is all there, behind your password."),
        ("Something was deleted by mistake", "Restore your most recent backup, under Settings."),
        ("The page looks broken", "Close the tab and open the link again. Nothing is lost; everything is saved as you type."),
    ]),
])
slide(F, "The short version", [
    lede("If you remember only one page, make it this one."),
    fields([
        ("Every week", "Update the bank balance. Put in the week&rsquo;s sales."),
        ("Whenever money moves", "Log it under Expenses. A minute each."),
        ("Before you say yes to anything", "Use <strong>Can we afford it?</strong>"),
        ("Before a meeting", "Use the <strong>Weekly update</strong>, or the working on the home page."),
        ("At the end of the year", "Use the <strong>Sports Club check</strong>."),
        ("Now and then", "Download a backup and keep it somewhere safe."),
        ("Never lose", "Your password. It is the only way in, and it cannot be reset."),
    ]),
    note("And the one rule behind all of it: the site organises, flags and recommends. You decide. It will never move a penny on its own.", "important"),
])

# ============================ RENDER =========================================
total = len(S)
sections, seen = [], set()
for s in S:
    if s["section"] not in seen:
        seen.add(s["section"]); sections.append(s["section"])

out = []
out.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>How to use Silent Partner</title>
<link rel="stylesheet" href="guide.css">
</head>
<body>
<header class="bar">
  <div class="bar-left">
    <span class="logo">SP</span>
    <span class="bar-title">How to use Silent Partner</span>
  </div>
  <div class="bar-right">
    <button id="contentsBtn" class="bar-btn">All the steps</button>
    <button id="printBtn" class="bar-btn">Print</button>
    <a class="bar-btn" href="index.html">Back to the site</a>
  </div>
</header>

<div id="contents" class="contents hidden">
  <div class="contents-inner">
    <div class="contents-head">
      <h2>All the steps</h2>
      <button id="contentsClose" class="bar-btn">Close</button>
    </div>
    <div class="contents-list">''')

n = 0
last = None
for i, s in enumerate(S):
    if s["section"] != last:
        out.append(f'<h3 class="contents-section">{s["section"]}</h3><div class="contents-grid">')
        last = s["section"]
        close_needed = True
    out.append(f'<button class="contents-item" data-go="{i}"><span class="num">{i+1}</span><span>{s["title"]}</span></button>')
    nxt = S[i+1]["section"] if i + 1 < len(S) else None
    if nxt != s["section"]:
        out.append('</div>')
out.append('''    </div>
  </div>
</div>

<main id="deck">''')

for i, s in enumerate(S):
    out.append(f'<section class="slide" data-i="{i}">')
    out.append('<div class="slide-inner">')
    out.append(f'<p class="eyebrow"><span class="chip">{s["section"]}</span> <span class="counter">Page {i+1} of {total}</span></p>')
    out.append(f'<h1>{s["title"]}</h1>')
    out.append("".join(s["blocks"]))
    out.append('</div></section>')

out.append(f'''</main>

<nav class="pager">
  <button id="prevBtn" class="pg">&larr; Back</button>
  <div class="pg-mid">
    <div class="progress"><div id="bar" class="bar-fill"></div></div>
    <div id="where" class="where">Page 1 of {total}</div>
  </div>
  <button id="nextBtn" class="pg primary">Next &rarr;</button>
</nav>

<script src="guide.js"></script>
</body>
</html>''')

io.open("guide.html", "w", encoding="utf-8").write("\n".join(out))
print(f"guide.html written: {total} pages, {len(sections)} sections")
for s in sections: print("   -", s)
