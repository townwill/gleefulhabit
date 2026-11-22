#!/bin/bash
# Luna's Lost Treasures - records every game line with a natural Mac voice.
# Run in Terminal:  bash ~/Downloads/luna-voices.sh
# Makes luna-voice.zip on your Desktop. Send that zip to Claude.
set -e
have_voice() { say -v '?' | sed -E 's/ +[a-z]{2,3}[_-][A-Za-z0-9_]+ +#.*$//' | grep -qFx "$1"; }
pick_voice() { for v in "$@"; do if have_voice "$v"; then echo "$v"; return; fi; done; echo "Samantha"; }
NARR="$(pick_voice "Ava (Premium)" "Ava (Enhanced)" "Zoe (Premium)" "Zoe (Enhanced)" "Samantha (Enhanced)" "Ava" "Samantha")"
LUNA="$(pick_voice "Joelle (Premium)" "Joelle (Enhanced)" "Joelle" "$NARR")"
WHIRLY="$LUNA"
echo "Narrator: $NARR"
echo "Luna:     $LUNA"
echo "Whirly:   $WHIRLY (Claude will pitch him up)"
case "$NARR" in *Premium*|*Enhanced*) ;; *) echo "Tip: for a nicer narrator, download Ava (Premium): System Settings > Accessibility > Read & Speak (or Spoken Content) > System Voice > Manage Voices > English > Ava (Premium). Then run this again.";; esac
OUT="$HOME/Desktop/luna-voice"
rm -rf "$OUT"; mkdir -p "$OUT"
n=0
while IFS='|' read -r key text; do
  [ -z "$key" ] && continue
  case "$key" in luna_*) V="$LUNA"; R=170;; whirly_*) V="$WHIRLY"; R=190;; *) V="$NARR"; R=165;; esac
  if ! say -v "$V" -r $R -o "$OUT/$key.m4a" --file-format=m4af --data-format=aac "$text" 2>/dev/null; then
    say -v "$V" -r $R -o "$OUT/$key.aiff" "$text"
  fi
  n=$((n+1)); printf "\r%d recorded" "$n"
done <<'LINES'
s1i1|This is Luna the unicorn. Luna loves her shiny treasures.
s1i2|But one windy morning, a silly wind named Whirly went WHOOSH! He blew Luna's treasures all over Rainbow Meadow.
s1o1|You did it! Luna's treasures are safe.
s1o2|But look! Whirly whooshed more treasures into the Whispering Woods!
s2i1|Welcome to the Whispering Woods. The trees are tall, and the mushrooms are spotty.
s2i2|Shh. An owl is watching! Can you find Luna's treasures in the woods?
s2o1|Hooray! The owl hooted, hoo-ray!
s2o2|But Whirly zoomed away, all the way up to Snowflake Mountain.
s3i1|Brrr! Snowflake Mountain is cold and sparkly.
s3i2|Oh dear, the snowman lost his carrot nose, too! Can you find the treasures in the snow?
s3o1|Great job! The snowman got his nose back. He says thank you!
s3o2|Next, Whirly blew right into Candy Kingdom!
s4i1|Yum! In Candy Kingdom, the trees are lollipops and the houses are cupcakes.
s4i2|Whirly hid Luna's treasures in between the sweets. Can you find them?
s4o1|Sweet work! Only one place left.
s4o2|Whirly flew way, way up into the night sky.
s5i1|The moon is up, and the stars are twinkling.
s5i2|Whirly lives up here in the clouds. Let's find the very last treasures!
s5o1|You found every treasure!
s5o4|And Luna and Whirly became best friends. The end!
start|Find the hidden treasures! Swipe to look around.
back|Welcome back! Let's find the rest of the treasures!
hint|Look by the sparkly circle.
bonus1|Wow! You found all the treasures!
bonus3|Can you find the letters in ABC order?
lettersdone|You found all the letters! Amazing!
oops|Oops!
locked|Finish the level before this one first!
found_star|You found the star!
found_heart|You found the heart!
found_crown|You found the crown!
found_balloon|You found the balloon!
found_butterfly|You found the butterfly!
found_wand|You found the magic wand!
found_diamond|You found the diamond!
found_cupcake|You found the cupcake!
found_key|You found the key!
found_bell|You found the bell!
found_shell|You found the seashell!
found_apple|You found the apple!
found_bow|You found the bow!
found_horseshoe|You found the lucky horseshoe!
found_kite|You found the kite!
found_acorn|You found the acorn!
found_feather|You found the feather!
found_ladybug|You found the ladybug!
found_teacup|You found the teacup!
found_ring|You found the ring!
found_gift|You found the present!
found_duck|You found the rubber duck!
found_umbrella|You found the umbrella!
found_mitten|You found the mitten!
found_carrot|You found the snowman's carrot!
found_moon|You found the moon!
find_star|Find the star!
find_heart|Find the heart!
find_crown|Find the crown!
find_balloon|Find the balloon!
find_butterfly|Find the butterfly!
find_wand|Find the magic wand!
find_diamond|Find the diamond!
find_cupcake|Find the cupcake!
find_key|Find the key!
find_bell|Find the bell!
find_shell|Find the seashell!
find_apple|Find the apple!
find_bow|Find the bow!
find_horseshoe|Find the lucky horseshoe!
find_kite|Find the kite!
find_acorn|Find the acorn!
find_feather|Find the feather!
find_ladybug|Find the ladybug!
find_teacup|Find the teacup!
find_ring|Find the ring!
find_gift|Find the present!
find_duck|Find the rubber duck!
find_umbrella|Find the umbrella!
find_mitten|Find the mitten!
find_carrot|Find the snowman's carrot!
find_moon|Find the moon!
let_A|The letter A!
let_B|The letter B!
let_C|The letter C!
let_D|The letter D!
let_E|The letter E!
let_F|The letter F!
let_G|The letter G!
let_H|The letter H!
let_I|The letter I!
let_J|The letter J!
let_K|The letter K!
let_L|The letter L!
let_M|The letter M!
let_N|The letter N!
let_O|The letter O!
let_P|The letter P!
let_Q|The letter Q!
let_R|The letter R!
let_S|The letter S!
let_T|The letter T!
let_U|The letter U!
let_V|The letter V!
let_W|The letter W!
let_X|The letter X!
let_Y|The letter Y!
let_Z|The letter Z!
findl_A|Find the letter A.
findl_B|Now find the letter B.
findl_C|Now find the letter C.
findl_D|Now find the letter D.
findl_E|Now find the letter E.
findl_F|Find the letter F.
findl_G|Now find the letter G.
findl_H|Now find the letter H.
findl_I|Now find the letter I.
findl_J|Now find the letter J.
findl_K|Find the letter K.
findl_L|Now find the letter L.
findl_M|Now find the letter M.
findl_N|Now find the letter N.
findl_O|Now find the letter O.
findl_P|Find the letter P.
findl_Q|Now find the letter Q.
findl_R|Now find the letter R.
findl_S|Now find the letter S.
findl_T|Now find the letter T.
findl_U|Find the letter U.
findl_V|Now find the letter V.
findl_W|Now find the letter W.
findl_X|Now find the letter X.
findl_Y|Now find the letter Y.
findl_Z|Now find the letter Z.
luna_hello|Hi! I'm Luna! Will you help me find my treasures?
luna_s1i3|Oh no! Can you help me find them?
luna_s5o3|That's okay, Whirly! Let's play hide and seek together!
luna_tap1|Hee hee! That tickles!
luna_tap2|Keep looking! You can do it!
luna_tap3|You are a great helper!
luna_tap4|Hello, friend!
whirly_s5o2|I'm sorry, Luna. I just wanted someone to play with.
whirly_bonus2|Whoosh! I hid some letters too!
whirly_half|Whoosh! You're really good at this!
whirly_tap1|Whoosh! Hee hee!
whirly_tap2|Catch me if you can!
whirly_tap3|Whee! I love the wind!
LINES
echo
printf "narrator=%s\nluna=%s\nwhirly=%s\n" "$NARR" "$LUNA" "$WHIRLY" > "$OUT/voices.txt"
cd "$HOME/Desktop" && rm -f luna-voice.zip && zip -qr luna-voice.zip luna-voice
echo "Done! Send luna-voice.zip from your Desktop to Claude."
