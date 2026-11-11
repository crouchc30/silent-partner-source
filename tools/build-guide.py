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
    p("There are %d short pages. Reading all of them takes about fifteen minutes." % len(S)),
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
        "<strong>It never sends anything to anybody.</strong> The weekly update is text you copy and send yourself, if you want to. The only emails it ever sends are codes, to you, about your own account.",
        "<strong>It never decides.</strong> It recommends, and it pushes back when something looks risky. Every decision stays yours.",
    ]),
    note("Every figure it shows can be traced back to something you typed. If a number ever looks wrong, there is a line of working you can read, and it is on the home page.", "tip"),
])
slide(A, "Your first twenty minutes", [
    lede("Do these five things, in this order. After the second one, the big number on the home page starts being real."),
    steps([
        "<strong>Make your account.</strong> Covered on the next few pages.",
        "<strong>Type in your bank balance.</strong> This is the foundation; nothing works properly without it.",
        "<strong>Add the bills that come every month.</strong> Payroll, taxes, anything regular.",
        "<strong>Add the last few weeks of sales.</strong> Eight weeks is plenty.",
        "<strong>From then on, log expenses as they happen.</strong> A minute each.",
    ]),
    note("You do not have to do it all at once. The site is useful after step 2, and gets more accurate with each one after that.", "tip"),
])

B = "Opening it"
slide(B, "Getting in the first time", [
    lede("Two steps, once. After that it is just your email and your password, on any device you like."),
    pic("lock-screen", "The first thing you see.", example=False),
    steps([
        "Type the <strong>word that came with your link</strong> and press <strong>Continue</strong>. "
        "Everyone who was sent the link uses the same word.",
        "Press <strong>Create an account</strong>.",
        "Put in <strong>your own email</strong> and choose a password. Type the password twice.",
        "Press <strong>Create account</strong>.",
        "We email you a <strong>code</strong>. Type it into the box on the next screen and press "
        "<strong>Confirm</strong>.",
    ]),
    note("A code, not a link. Links get broken by the thing that opens them &mdash; a work inbox that "
         "strips them, a phone that opens the wrong browser. A row of digits you read and type works "
         "anywhere, including from a phone screen while you sit at the shop computer.", "plain"),
    note("The word from the link is just the front door &mdash; it is the same for everybody and it is not what protects your figures. "
         "<strong>Your account is what protects them.</strong> Nobody can see a single number without one.", "plain"),
    note("Use an email you can actually open. If you ever forget your password, that is where the code goes.", "important"),
])
slide(B, "The code from the email", [
    lede("The same screen does two jobs: proving a new email address is yours, and proving it is still yours if the password has gone."),
    bullets([
        "It can take <strong>a minute</strong> to arrive. If it has not, look in the junk folder.",
        "Type it in, or paste it &mdash; <strong>spaces do not matter</strong>, they get tidied up.",
        "A code stops working after <strong>an hour</strong>.",
        "<strong>Send me another code</strong> gets a fresh one. The moment you do, the old one stops working, so use the newest email.",
    ]),
    note("If it says the code is not right, the usual cause is reading an older email. Codes arrive in "
         "order and only the last one counts.", "tip"),
])
slide(B, "Signing in after that", [
    lede("Your email and your password. Nothing else to remember, and it works on any computer, tablet or phone."),
    steps([
        "Open the link.",
        "Type the word from the link, if it asks.",
        "Put in your email and password, and press <strong>Sign in</strong>.",
    ]),
    note("The books live online now, not on one computer. Sign in on the shop computer, on the laptop at home, on a phone &mdash; "
         "it is the same set of books, with the same figures, every time.", "plain"),
])
slide(B, "Changing your password when you know it", [
    lede("Settings, at any time. It changes your own account only &mdash; nobody else&rsquo;s sign-in is affected and the books are untouched."),
    pic("settings-account", "Where to do it.", example=False),
    note("Choose a <strong>phrase</strong>, not a word. Four ordinary words you will remember beat one clever word you will not.", "important"),
])
slide(B, "If you forget your password", [
    lede("This used to be the end of the world. It is now a two-minute inconvenience."),
    steps([
        "On the sign-in screen, press <strong>Forgot your password?</strong>",
        "Put in your email and press <strong>Email me a code</strong>.",
        "Type the code from the email and press <strong>Confirm</strong>.",
        "Pick a new password, twice, and press <strong>Save new password</strong>.",
    ]),
    p("You are taken straight into the books afterwards. There is nothing else to do."),
    note("Nothing in the books is touched by this. You are changing the key to your own account, not the books themselves, "
         "and nobody else&rsquo;s sign-in changes.", "plain"),
])
slide(B, "Two of you, at the same time", [
    lede("More than one person can have the site open at once, and nobody&rsquo;s typing gets lost."),
    bullets([
        "Everyone makes <strong>their own account</strong>, with their own email and their own password.",
        "Everyone sees the <strong>same books</strong>, kept up to date as it happens.",
        "If somebody else changes something while you are looking, the page quietly updates and tells you who did it.",
        "If you both save at the same moment, <strong>both entries are kept</strong>. Neither one wipes the other.",
    ]),
    note("Settings shows you who else has an account on these books, so you can always check.", "tip"),
])
slide(B, "Signing out", [
    lede("Press <strong>Sign out</strong>, on the right of the bar along the top, whenever you walk away from a shared computer."),
    pic("topbar", "The bar along the top.", example=False),
    bullets([
        "Nothing is lost. Every entry is saved the moment you type it.",
        "If you forget, the site signs you out on its own after an hour of being left alone.",
        "To get back in, your email and your password.",
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
slide(F, "History: who did what", [
    lede("Every sign-in and every change, with a name and a time against it. Anyone who can open the books can read it."),
    pic("history", "Who did what, newest first."),
    p("Press <strong>History</strong> along the top. The newest thing is at the top. It will tell you, for instance, that Shelly "
      "marked an invoice paid on Tuesday afternoon, or that you added a bank balance on Friday."),
    bullets([
        "Use the dropdown to show <strong>just one person</strong>.",
        "Tick <strong>changes only</strong> to hide the sign-ins and see only what was actually altered.",
        "<strong>Download as a spreadsheet</strong> if you want it on paper or for your accountant.",
    ]),
    note("Nothing in History can be edited or deleted, by anybody, including whoever set the site up. "
         "A record that could be tidied up afterwards would not be worth keeping.", "plain"),
    note("If a name you do not recognise appears, check <strong>Settings</strong> &mdash; it lists everyone who has an account on these books.", "tip"),
])
slide(F, "Keeping a copy", [
    lede("The books live online and are saved as you type. A backup is a copy of your own, in a file, in case you ever want one."),
    pic("settings-data", "At the bottom of Settings."),
    bullets([
        "<strong>Download a backup</strong> saves everything to one file on this computer.",
        "<strong>Restore backup</strong> puts one back. It replaces what is there now, for everybody, so it asks first.",
        "<strong>Download expenses</strong> gives you a plain spreadsheet for your accountant.",
    ]),
    note("Both of those files are <strong>plain and readable</strong>. Anyone who gets hold of one can read every figure in it. "
         "Keep them where you would keep a bank statement, and think twice before emailing one.", "warn"),
    note("You do not need to take a backup to avoid losing work. Your work is saved online the moment you type it, "
         "and it is still there if this computer is dropped in a puddle. A backup is for having a copy of your own.", "plain"),
])
slide(F, "If something looks wrong", [
    lede("The usual causes, and what to do about them."),
    fields([
        ("The big number looks too low", "Read the working on the home page. Usually a large unpaid bill, or a repeat bill falling inside the window."),
        ("The big number says $0", "Your known bills use up everything above the cushion. The working will name them."),
        ("A number has not changed", "Check whether the expense is waiting under <strong>Needs your OK</strong>. Incomplete entries are left out until they are finished."),
        ("My password will not work", "Check Caps Lock first. If it still will not, press <strong>Forgot your password?</strong> on the sign-in screen and we will email you a code to set a new one."),
        ("The word from the link is not enough", "That word only opens the front door. After it you need your own email and password. If you have not made an account yet, press <strong>Create an account</strong>."),
        ("The code has not arrived", "Give it a minute, then look in the junk folder. <strong>Send me another code</strong> on that same screen gets a fresh one."),
        ("It says my code is wrong", "Check you are reading the newest email. Asking for another code stops the one before it from working."),
        ("It says my code has expired", "Codes last an hour. Press <strong>Send me another code</strong>."),
        ("Somebody changed something I did not expect", "Open <strong>History</strong>. It will tell you who, what, and when."),
        ("Does closing the page lose my work?", "No. Every entry is saved online the moment you type it. Close the tab, change computers, come back next week: sign in and it is all there."),
        ("Something was deleted by mistake", "Check <strong>History</strong> to see what went and who removed it, then type it back in. If a lot went at once, restore a backup under Settings."),
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
        ("If you forget your password", "Press <strong>Forgot your password?</strong>, type the code we email you, pick a new one. It is no longer a disaster."),
        ("To see who did what", "Open <strong>History</strong>."),
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
