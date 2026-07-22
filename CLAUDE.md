@AGENTS.md

# Web app is the source of truth

Before implementing or modifying ANY feature here, find and read the corresponding
implementation in the web repo (`/Users/papa/Desktop/Trail Tracker`) first — the
component, API route, and any shared lib/helper it uses. Port its actual behavior,
copy, and business logic; don't rebuild from a general idea of what the feature
"should" do. If you deviate from web on purpose (native-only capability, offline
constraint, premium gating difference, etc.), say so explicitly and why. If you
can't find a web equivalent, say that too before proceeding, rather than guessing.
