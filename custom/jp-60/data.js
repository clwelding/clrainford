/* JP-60 Commercial Jerk Pit - build data (phases, steps, tools, BOM, cut list). Source: JP-60 Shop Manual. */
const PHASES = [
  {id:"p0", name:"Prep & safety"},
  {id:"p1", name:"Layout & cutting"},
  {id:"p2", name:"Body fabrication"},
  {id:"p3", name:"Stand & mobility"},
  {id:"p4", name:"Lids & hardware"},
  {id:"p5", name:"Fire & cook internals"},
  {id:"p6", name:"Shelves & fit-out"},
  {id:"p7", name:"Finish & seasoning"},
  {id:"p8", name:"QC & handoff"}
];
const PPE = {
  glasses:"Safety glasses (Z87+)", helmet:"Auto-dark helmet, shade 10–13", shade:"Shade 5–8 lenses (plasma)",
  faceshield:"Face shield over glasses", gloves:"Leather gloves", cut:"Cut-resistant gloves", tig:"TIG gloves",
  chem:"Chemical-resistant gloves", fr:"FR jacket or sleeves", boots:"Steel-toe boots", hearing:"Hearing protection",
  resp:"Respirator (P100 for fume, OV for paint)", heat:"High-heat BBQ gloves", nitrile:"Nitrile gloves"
};

const CARDS = [
/* ---------- P0 ---------- */
{id:"01", p:"p0", hrs:0.5, crew:"All hands", title:"Safety briefing and hot-work permit",
 goal:"Everyone on this build knows the hazards, the PPE, and where the extinguishers and exits are before any arc is struck.",
 steps:[
  "Hold a 10-minute toolbox talk covering this build: plate handling, plasma and grinding, MIG on carbon steel, TIG on stainless, high-heat paint, and the outdoor burn-in.",
  "Walk the bay: two charged ABC extinguishers within 30 ft of the weld area, eyewash and first-aid kit stocked, exits clear.",
  "Clear combustibles 35 ft from hot work, or cover what can't move with fire-retardant blankets. Sweep up dust, rags, and cardboard.",
  "Fill out and post the hot-work permit. Name a fire watch for every hot-work shift.",
  "Turn on fume extraction and shop ventilation and aim it at the weld zone.",
  "Inspect welder leads, grinder cords, and plugs. Tag out anything damaged.",
  "Everyone signs the safety block on the build traveler."],
 tools:["Hot-work permit","ABC extinguishers (2)","First-aid kit and eyewash","Fire-retardant blankets","Build traveler"],
 ppe:["glasses","boots"],
 haz:["No galvanized, zinc-plated, or cadmium-plated material goes on this pit, anywhere. Heated zinc gives off fumes that cause metal fume fever, and it contaminates food.",
      "Fire watch stays on station at least 30 minutes after the last hot work of the day."],
 qc:["Permit posted and signed","Fire watch named on the traveler","Extinguishers tagged and in date"]},

{id:"02", p:"p0", hrs:0.75, crew:"Lead fabricator", title:"Review drawings and lock the build spec",
 goal:"Confirm the JP-60 baseline (or the customer's changes) before anything gets cut.",
 steps:[
  "Open the Specs tab and walk the crew through overall dimensions, grate height, and coal-tray heights.",
  "Confirm customer options: side shelves, tow handle, paint color, branding or serial plate, extra grate sets.",
  "Note the customer's local requirements (health department, fire marshal, vending rules) and anything that changes the build, such as stainless food-contact surfaces, labels, or clearances.",
  "Mark changes on the drawing in red and initial them.",
  "Nest plate parts to fit two 48″ × 96″ sheets of 3/16″ (CNC file or chalk layout plan).",
  "Assign roles: lead fabricator, welder(s), fitter, fire watch."],
 tools:["Specs tab / drawings","Build traveler","CNC nesting software (if using CNC plasma)","Red pen"],
 ppe:["glasses"],
 haz:["Dimensions in this manual are nominal shop baselines. The lead verifies them against the actual build before cutting."],
 qc:["Spec signed off by lead","Customer options recorded on traveler","Nest plan approved"]},

{id:"03", p:"p0", hrs:1, crew:"Fitter + helper", title:"Receive and inspect material",
 goal:"Every piece of steel is the right grade, thickness, and size, and nothing coated or galvanized gets into the build.",
 steps:[
  "Check every piece against the BOM on the Materials tab: grade, thickness, size, and count.",
  "Reject anything galvanized, zinc-plated, or coated with an unknown finish. Galvanized has a dull grey or spangled zinc look. If in doubt, set it aside.",
  "Caliper plate thickness in three spots: 3/16″ reads 0.1875″, 10 ga reads about 0.135″.",
  "Verify stainless is 304 (mill cert or stencil). Store it apart from carbon steel so it doesn't pick up rust staining.",
  "Check casters for load rating (500 lb or more each) and that the brakes lock.",
  "Stage material on racks or dunnage near the cut station, not flat on the floor."],
 tools:["Calipers","25 ft tape","BOM printout","Magnet (304 is mostly non-magnetic)","Plate clamp and hoist","Dunnage"],
 ppe:["glasses","cut","boots"],
 haz:["3/16″ plate weighs about 7.7 lb per sq ft. A full 48″ × 96″ sheet is about 245 lb. Move sheets with a hoist and plate clamp, never by hand.",
      "Sheared edges cut. Wear cut-resistant gloves handling plate and sheet."],
 qc:["BOM fully checked off","No coated or galvanized material in the build","Stainless segregated"]},

{id:"04", p:"p0", hrs:0.75, crew:"Welder", title:"Stage tools, consumables, and weld settings",
 goal:"Machines are dialed in on scrap and every tool and consumable is in the bay before fabrication starts.",
 steps:[
  "Pull every tool on the Tools tab to the bay. Check each grinder guard and the RPM rating on every wheel.",
  "Load the MIG: ER70S-6 .035″ wire, 75/25 argon/CO₂ at 25–30 CFH.",
  "Set the TIG for stainless: DCEN, 3/32″ 2% lanthanated tungsten, ER308L filler, 100% argon at 15–20 CFH. Lay out stainless-only brushes.",
  "Run test beads on 3/16″ scrap. Dial in full fusion with no undercut, then do a quick bend test. Record settings on the traveler.",
  "Stock consumables: plasma tips and electrodes, cutoff wheels, flap discs (40/60/80), contact tips, nozzle gel.",
  "Confirm the weld table is flat and clean. Set out magnets, squares, and clamps."],
 tools:["MIG welder 250A+","TIG welder (AC/DC)","Plasma cutter","Angle grinders","Consumables","3/16″ test scrap"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:["Never mount a wheel rated below the grinder's RPM, and never run a grinder with the guard off."],
 qc:["Test weld passes visual and bend check","Settings written on traveler"]},

/* ---------- P1 ---------- */
{id:"05", p:"p1", hrs:1, crew:"Fitter", title:"Lay out body plates",
 goal:"All five body panels are marked square and labeled on two sheets.",
 steps:[
  "Square sheet 1 off a factory edge and check the corner with a framing square or 3-4-5.",
  "Sheet 1: lay out the Floor P1 (60″ × 30″), then both End walls P4 (29-5/8″ × 24″) side by side in the remaining 36″ × 48″.",
  "Sheet 2: lay out the Front wall P2 and Back wall P3 (60″ × 24″ each).",
  "Leave room for kerf (about 1/16″ for plasma). Layout lines are the part edge; cut on the waste side.",
  "Label every part with paint marker: part number, inside/outside face, and top edge.",
  "Using CNC: load the nest, verify sheet origin, and measure the first cut part before running the rest."],
 tools:["25 ft tape","Framing square","48″ straightedge","Soapstone and paint marker","Scribe","CNC plasma (optional)"],
 ppe:["glasses","cut","boots"],
 haz:[],
 qc:["Each layout's diagonals match within 1/16″","All parts labeled with number, face, and top"]},

{id:"06", p:"p1", hrs:2, crew:"Fitter", title:"Cut body plates",
 goal:"Floor, front, back, and both end walls are cut to size and square.",
 steps:[
  "Clamp a straightedge guide for handheld plasma, or run the CNC nest.",
  "Cut P1, P2, P3, and both P4 panels.",
  "Measure each panel. Grind or recut anything more than 1/16″ oversize.",
  "Check diagonals on every panel: within 1/8″.",
  "Knock off dross on both faces. Mark hot parts HOT with soapstone and set them on steel, not wood."],
 tools:["Plasma cutter 45–65A or CNC table","Straightedge guide and clamps","Angle grinder","Chipping hammer"],
 ppe:["glasses","shade","gloves","fr","boots","hearing"],
 haz:["The plasma arc throws UV. Use shade 5–8 lenses and put up screens for anyone nearby.",
      "Fresh-cut parts stay hot for minutes and look cold."],
 qc:["All five panels within ±1/16″","Panel diagonals within 1/8″"]},

{id:"07", p:"p1", hrs:1.5, crew:"Fitter", title:"Cut openings in the body panels",
 goal:"Air intakes, ash cleanout, and drain hole are cut in the right places before assembly.",
 steps:[
  "Front wall P2: lay out two intake openings 3″ tall × 10″ wide, bottom edge 1-1/2″ above the bottom of the wall, centered at 15″ and 45″ from the left end.",
  "Left end wall P4: lay out the ash cleanout 18″ wide × 5″ tall, bottom edge 1″ above the wall bottom, centered side to side.",
  "Floor P1: mark a 1-1/16″ hole 2″ in from each edge at the front-right corner for the 3/4″ NPT drain coupling.",
  "Cut the openings. Radius inside corners about 1/4″ so they don't start cracks.",
  "Cut the cleanout door P5 (19″ × 6″) and two damper slides P6 (4-1/2″ × 12″) from 3/16″ drop.",
  "Deburr every opening edge."],
 tools:["Plasma cutter","Step bit or annular cutter","Angle grinder","Files"],
 ppe:["glasses","shade","gloves","fr","boots","hearing"],
 haz:[],
 qc:["Opening positions within 1/8″","Inside corners radiused, no notches"]},

{id:"08", p:"p1", hrs:2, crew:"Fitter", title:"Cut structural members and bar stock",
 goal:"Every angle, tube, flat bar, and rod part is cut, tagged, and bundled by sub-assembly.",
 steps:[
  "Cut angle, tube, flat bar, and rod per the Cut list on the Materials tab.",
  "Miter the lid landing angle and coal-tray frame corners at 45°.",
  "Cut the 54 coal-tray bars from 3/8″ round with a stop block so they all match.",
  "Cut stainless on its own blade or wheel. Keep stainless chips out of the carbon steel bins.",
  "Bundle and tag parts: BODY, STAND, LIDS, TRAYS, GRATES, SHELVES."],
 tools:["Cold saw or horizontal bandsaw","Stop block","Deburring tool","Part tags"],
 ppe:["glasses","faceshield","gloves","hearing","boots"],
 haz:["Clamp short parts. Never hand-hold work at a saw; keep hands 6″ from the blade."],
 qc:["Every 10th stop-block part spot-checked","All bundles tagged"]},

{id:"09", p:"p1", hrs:1.5, crew:"Fitter", title:"Clean and prep weld joints",
 goal:"Every joint is bright metal so the welds go in clean and sound.",
 steps:[
  "3/16″ plate fillets fine without a full bevel. Grind mill scale back 1″ from every weld joint to bright metal.",
  "Wipe joints with acetone to remove oil and marker.",
  "Break sharp edges on parts that will be exposed on the finished pit.",
  "Re-mark any labels you ground off."],
 tools:["Angle grinder","40/60 flap discs","Acetone and clean rags","Paint marker"],
 ppe:["glasses","faceshield","gloves","hearing","boots"],
 haz:["Acetone is flammable. Keep rags in a closed metal can and away from hot work."],
 qc:["Bright metal at every joint","No oil or marker in weld zones"]},

/* ---------- P2 ---------- */
{id:"10", p:"p2", hrs:2, crew:"Fitter + welder", title:"Tack the floor and long walls",
 goal:"Front and back walls stand plumb on the floor and are tacked solid.",
 steps:[
  "Lay Floor P1 flat on the weld table, inside face up.",
  "Hoist Front wall P2 onto the floor's front edge with outside faces flush. Hold it plumb with magnetic squares and clamps.",
  "Tack every 6″, working from the center out. Keep tacks about 1/2″ long.",
  "Repeat with Back wall P3 on the back edge.",
  "Brace across the top with a temporary flat-bar spreader so the inside width holds at 29-5/8″."],
 tools:["Hoist and plate clamp","Magnetic squares","C-clamps and F-clamps","MIG welder","Temporary spreader bar"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:["Each long wall is about 77 lb. Two-person lift or hoist, and keep feet clear until it's tacked."],
 qc:["Walls plumb within 1/16″ over 24″","Inside width 29-5/8″ at both ends and center"]},

{id:"11", p:"p2", hrs:1, crew:"Fitter + welder", title:"Tack the end walls and square the box",
 goal:"The body is a square, flat box ready for weld-out.",
 steps:[
  "Drop each End wall P4 between the front and back walls onto the floor. The cleanout opening goes on the left end.",
  "Clamp tight. Tack the bottom edge, then the corners.",
  "Measure the top diagonals. They must match within 1/8″. Rack the box with a clamp or porta-power until square, then add tacks.",
  "Lay a straightedge across the top edges and mark any high spots to grind later."],
 tools:["Tape","Bar clamps","Porta-power or ratchet strap","Straightedge","MIG welder"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:[],
 qc:["Top diagonals within 1/8″","Box sits flat on the table, no rocking"]},

{id:"12", p:"p2", hrs:4, crew:"Welder", title:"Weld out the body",
 goal:"All body seams are welded smoke-tight and water-tight without pulling the box out of square.",
 steps:[
  "Weld in 2–3″ stitches and skip around the box, jumping corner to corner, to balance heat and stop warping.",
  "Outside: run continuous fillets on all four vertical corners and around the floor perimeter. These seams must be smoke-tight and water-tight.",
  "Inside: 2″ stitches every 6″ along the floor seams for strength. Keep them smooth so ash cleans out easily.",
  "Let each area cool to hand-warm before welding beside it. Don't quench with water.",
  "Remove the spreader. Recheck square and plumb.",
  "Weld the 3/4″ NPT half-coupling under the drain hole with a full fillet, and thread in the steel plug."],
 tools:["MIG welder","Chipping hammer","Wire brush","Fillet gauge","Framing square"],
 ppe:["glasses","helmet","gloves","fr","boots","resp"],
 haz:["Run fume extraction at the arc and keep your head out of the plume.",
      "The box gets hot. Leather gloves on to handle it."],
 qc:["No cracks, porosity, or undercut on outside seams","Fillets at least 3/16″ (gauge-checked)","Box still square within 1/8″"]},

{id:"13", p:"p2", hrs:1.5, crew:"Welder", title:"Install grate ledges and center divider",
 goal:"Level ledges carry the cooking grates, and the center divider splits the pit into two cook zones.",
 steps:[
  "Mark a level line inside the front and back walls at 22″ above the floor.",
  "Set the 2″ × 2″ × 3/16″ angle ledges P7 with the horizontal leg pointing into the pit and its top on the 22″ line.",
  "Stitch-weld along the top: 1-1/2″ welds every 6″.",
  "Fit the center web P8 (2″ × 1/4″ flat on edge) across the pit at the 30″ centerline, resting on the ledges, top flush with the wall tops. Weld to both walls.",
  "Weld the center cap P9 (3″ × 1/4″ flat) flat on top of the web, centered. This is where both lids land.",
  "Check the ledges are level end to end and the same height front and back."],
 tools:["Level","Tape","Clamps","MIG welder"],
 ppe:["glasses","helmet","gloves","fr","boots","resp"],
 haz:[],
 qc:["Ledges level within ±1/16″","Center cap flush with wall tops"]},

{id:"14", p:"p2", hrs:1.5, crew:"Welder", title:"Install the lid landing angle",
 goal:"A level ledge around the outside of the body for the lid skirts to land on.",
 steps:[
  "Mark a line around the outside of the body 1-1/2″ below the top edge.",
  "Fit the 1-1/2″ × 1-1/2″ × 3/16″ angle P10 around the outside: vertical leg down against the wall, horizontal leg sticking out, top surface on the line. Corners mitered.",
  "Tack and check level all around.",
  "Stitch-weld the top edge 2″ every 6″ and fully weld the miters.",
  "Grind the miter welds flush so the lid skirts sit clean."],
 tools:["Tape","Level","Clamps","MIG welder","Angle grinder"],
 ppe:["glasses","helmet","gloves","fr","boots","hearing"],
 haz:[],
 qc:["Landing level within 1/16″ all around","Miters ground flush"]},

{id:"15", p:"p2", hrs:2, crew:"Welder", title:"Build intake dampers and ash cleanout door",
 goal:"Two sliding air intakes and a drop-down cleanout door that work with one gloved hand.",
 steps:[
  "For each intake, weld a 1/4″ × 1/2″ spacer strip above and below the opening, 24″ long, positioned so the slide can travel fully open and fully closed.",
  "Weld a 1/4″ × 1″ cap strip over each spacer so the 3/16″ slide P6 rides in the slot.",
  "Check the slide moves by hand with light drag. Grind the guides if it binds.",
  "Weld a 1/2″ round-bar pull to each slide. Add a bolt-in stop at one end so the slide can't fall out but can come out for cleaning.",
  "Hinge the cleanout door P5 on its bottom edge with a 1/2″ pin hinge so it drops open. Add a turn latch at the top.",
  "Function test both dampers and the door."],
 tools:["MIG welder","Clamps","Angle grinder","Drill and tap (1/4-20)"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:[],
 qc:["Slides move freely from open to closed","Cleanout door latches with 1/16″ gap or less"]},

/* ---------- P3 ---------- */
{id:"16", p:"p3", hrs:3, crew:"Welder", title:"Fabricate the stand frame",
 goal:"A square, flat stand that puts the cooking grate at about 36″ working height.",
 steps:[
  "Lay out the top frame: two 60″ long rails P19 and four 26″ cross rails P20 (two at the ends, two at 20″ and 40″). Outside size 60″ × 30″.",
  "Tack, check diagonals within 1/8″, then weld every joint all around. Cap open tube ends.",
  "Weld the four 6″ legs P21 plumb at the corners under the frame.",
  "Weld 3/8″ caster plates P22 to each leg. Drill caster bolt holes to match the casters on hand.",
  "Weld on the tow handle at the right end if the customer ordered it."],
 tools:["Cold saw","Magnetic squares","Tape","MIG welder","Drill press or mag drill"],
 ppe:["glasses","helmet","gloves","fr","boots","hearing"],
 haz:[],
 qc:["Frame flat and square (diagonals ±1/8″)","Legs plumb","Caster holes match the caster pattern"]},

{id:"17", p:"p3", hrs:0.5, crew:"Fitter", title:"Mount the casters",
 goal:"The pit rolls straight, steers from the handle end, and locks solid.",
 steps:[
  "Bolt two locking swivel casters at the handle end and two rigid casters at the other end with 3/8″ grade 8 bolts (plain or stainless finish) and nylon-insert locknuts.",
  "Torque to the caster maker's spec and witness-mark each nut with paint pen.",
  "Roll test: frame tracks straight and the brakes lock both the wheel and the swivel."],
 tools:["Socket set","Torque wrench","Paint pen"],
 ppe:["glasses","gloves","boots"],
 haz:[],
 qc:["All bolts torqued and witness-marked","Brakes hold on a ramp test"]},

{id:"18", p:"p3", hrs:1.5, crew:"Fitter + welder", title:"Mate the body to the stand",
 goal:"The body is lifted onto the stand and welded down so it can still expand with heat.",
 steps:[
  "Rig the body with rated slings or plate clamps on a spreader. Lift 2″ and check balance before going higher.",
  "Lower the body onto the stand and align it flush on all sides.",
  "Weld the floor to the stand top frame with 2″ stitches every 8″ on the outside. Keep it stitched, not continuous, so the floor can expand.",
  "Optional: hang a 16 ga heat shield under the floor on 1″ standoffs to protect casters and anything stored below."],
 tools:["Overhead hoist or forklift","Rated slings and spreader","Tag lines","MIG welder"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:["Never stand under a suspended load. The body alone is about 330 lb. Guide it with tag lines, not hands."],
 qc:["Body flush on the stand","Unit stable with no rocking"]},

/* ---------- P4 ---------- */
{id:"19", p:"p4", hrs:4, crew:"Welder", title:"Fabricate the two lids",
 goal:"Two flat, rigid lids that land evenly on the body and close with an even gap.",
 steps:[
  "Measure the as-built body. Lid inside depth = body depth + 1/4″. Each lid runs from the outer end face (+1/8″) to the center cap, with a 1/4″ gap between the lids. Adjust P12–P15 if the body grew.",
  "Tack the front and back skirts (10″) and the outer end skirt (10″) to the lid top P12. The inner end skirt is 8-1/4″ tall because it lands on the center cap.",
  "Fit-test each lid on the body before welding: skirts land evenly on the landing angle and cap, about 1/8″ clearance all around.",
  "Weld lid corners outside with short stitches, then fill in. 10 ga warps easily, so skip around and keep heat low.",
  "Weld two 1″ × 1/8″ flat bar stiffeners across the inside of each lid top to keep it flat.",
  "Cut a 3-9/16″ hole in each lid top for the stack: centered side to side, 5″ from the back edge."],
 tools:["Tape","Magnetic squares","MIG welder","Plasma or hole saw","Angle grinder"],
 ppe:["glasses","helmet","gloves","fr","boots","cut"],
 haz:[],
 qc:["Lids sit flat with no rocking, gap 1/8″ or less","Lid tops flat, no oil-canning"]},

{id:"20", p:"p4", hrs:3, crew:"Fitter + welder", title:"Hinges, counterweights, and lid stops",
 goal:"Each lid swings open smoothly, stays open on its own, and can't flip over backward.",
 steps:[
  "Clamp each lid closed on the body.",
  "Position two 5/8″ weld-on bullet hinges per lid, about 4″ in from each lid end, pin axis about 1/2″ behind the back skirt and level with the skirt bottom.",
  "Weld 3/16″ hinge tabs P11 to the back wall under the landing angle. Weld the fixed hinge leaf to the tab and the moving leaf to the lid back skirt. Tack only.",
  "Swing test: the lid opens to about 100° without binding or hitting anything.",
  "Weld two 1″ × 1″ counterweight arms P16 to each lid's back skirt, angled back past the hinge line. Bolt a 1/2″ plate counterweight P17 to their ends and trim it until the lid stays put at 90° and lifts with a light pull.",
  "Weld lid stops so the lid can't swing past about 105°.",
  "Finish all hinge welds. Coat hinge pins with high-temp anti-seize."],
 tools:["Clamps","MIG welder","Drill and taps","High-temp anti-seize","Fish scale (lift force)"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:["Hinges and counterweight arms are pinch points. Keep fingers clear during every swing test. Each lid is about 55 lb before the counterweight."],
 qc:["Lid lifts with about 15 lb of pull or less","Lid stays open at 90°","Stops prevent over-travel"]},

{id:"21", p:"p4", hrs:1.5, crew:"Welder", title:"Stacks and stack dampers",
 goal:"Each lid has a plumb exhaust stack with a damper that holds where it's set.",
 steps:[
  "Cut two 18″ lengths of 3″ schedule 40 pipe.",
  "Drill 1/4″ cross holes 4″ from the top for the butterfly damper rod.",
  "Weld each stack into its lid hole, plumb, flush with the inside of the lid. Full fillet outside.",
  "Install the butterfly: a 14 ga disc about 2-15/16″ across on a 1/4″ rod, with a spring washer so it holds position. Bend a handle on the rod.",
  "Add a rain cap if the customer ordered one."],
 tools:["Cold saw","Drill press","MIG welder","Level"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:[],
 qc:["Stacks plumb","Dampers hold position when set"]},

{id:"22", p:"p4", hrs:1, crew:"Fitter", title:"Lid handles and thermometers",
 goal:"Handles stay cool enough to grab, and each zone has a working thermometer at grate level.",
 steps:[
  "Weld two 3/8″ rod standoffs P35, 3″ long, about 12″ apart, centered on each lid's front skirt.",
  "Mount a 1-1/4″ hardwood handle with a stainless through-bolt, or a stainless spring-coil handle.",
  "Drill the thermometer hole in the center of each front skirt, 4″ above the skirt bottom (about 2-1/2″ above the grate).",
  "Install 3″ dial thermometers (50–550°F) with their mounting nuts.",
  "Check the handles sit at least 3″ off the lid skin."],
 tools:["MIG welder","Drill and step bit","Wrenches"],
 ppe:["glasses","helmet","gloves","boots"],
 haz:[],
 qc:["Handles rigid","Thermometers read room temperature within ±5°F"]},

/* ---------- P5 ---------- */
{id:"23", p:"p5", hrs:4, crew:"Welder", title:"Build the coal trays",
 goal:"Three lift-out coal trays with swap-in legs that set the fire 6″, 10″, or 14″ off the floor.",
 steps:[
  "Weld each tray frame from 1-1/2″ angle, 29″ × 19-1/2″ outside, horizontal legs pointing in, square within 1/8″.",
  "Lay 18 bars of 3/8″ round front to back across each frame at 1″ centers and weld each end to the horizontal legs.",
  "Weld a 1″ × 14 ga square-tube sleeve P26 upright in each inside corner.",
  "Cut leg sets from 3/4″ × 11 ga square tube so the tray grate sits at 6″, 10″, or 14″ above the floor (about 5″, 9″, and 13″ long; cut to fit). Drill 3/8″ pin holes through sleeves and legs.",
  "Stamp each leg 6, 10, or 14.",
  "Weld two 1/2″ round lift loops on each short side of every tray.",
  "Test: the three trays drop in side by side with about 1″ of total play, and legs swap without tools."],
 tools:["MIG welder","Stop block","Drill press","Letter/number stamps","Hitch pins"],
 ppe:["glasses","helmet","gloves","fr","boots"],
 haz:[],
 qc:["Trays fit with about 1″ of play","All three heights work and legs are stamped"]},

{id:"24", p:"p5", hrs:4, crew:"TIG welder", title:"Build the stainless cooking grates",
 goal:"Four food-safe 304 stainless grates, two per cook zone, clean and passivated.",
 steps:[
  "Build four frames from 1/4″ × 1″ 304 flat bar, 14-1/2″ × 29-1/4″ outside.",
  "Weld 3/8″ 304 rods across the short direction at 1″ centers, about 27 rods per grate.",
  "TIG with ER308L and 100% argon. Keep heat low to limit discoloration. Use only stainless-dedicated brushes and discs.",
  "Remove heat tint with pickling paste or an electrochemical weld cleaner, then rinse thoroughly per the product SDS.",
  "Fit test: two grates sit on the ledges in each zone and lift out with the grate hooks."],
 tools:["TIG welder","ER308L filler","Stainless-only brushes and discs","Weld cleaner or pickling paste"],
 ppe:["glasses","helmet","tig","fr","boots","resp","chem"],
 haz:["Welding stainless makes hexavalent chromium fume. Run local exhaust at the arc and wear a P100 respirator.",
      "Pickling paste is strong acid. Chemical gloves and face shield, and neutralize and dispose of rinse water per the SDS."],
 qc:["No sharp ends or spatter on food surfaces","Heat tint removed and grates passivated"]},

{id:"25", p:"p5", hrs:0.5, crew:"Fitter", title:"Pimento stick setup and grate hooks",
 goal:"The pit works the traditional way, with meat laid on pimento wood sticks over the coals, as well as on the steel grates.",
 steps:[
  "Pimento (allspice) wood is the traditional jerk grill: green sticks laid across the fire carry the meat and give jerk its signature flavor.",
  "Sticks rest front to back on the 22″ grate ledges. Spec them about 29-1/4″ long and 1″–1-1/2″ thick, fresh or soaked.",
  "Stainless grates are the everyday surface. Sticks go on top of or in place of the grates, depending on the cook's method.",
  "Confirm with the customer where they'll source sticks (untreated, food-safe wood only) and whether a starter bundle ships with the pit.",
  "Bend two grate and stick hooks from 3/8″ rod and fit wood handles."],
 tools:["Tape","Bench vise","Torch or bender","Wood handles"],
 ppe:["glasses","gloves"],
 haz:["Food-safe untreated wood only. Never pressure-treated, painted, or scrap wood of unknown origin."],
 qc:["Sticks fit the ledge span","Two hooks made"]},

/* ---------- P6 ---------- */
{id:"26", p:"p6", hrs:3, crew:"Fitter + welder", title:"Fold-down side shelves",
 goal:"Two stainless prep shelves that fold flat for transport and hold 50 lb without sagging.",
 steps:[
  "Weld two shelf frames from 1-1/4″ × 1/8″ angle, 16″ × 28″.",
  "Brake 16 ga 304 tops (18″ × 30″ blanks) with a 1″ turn-down on three sides. Fasten to the frames with stainless rivets or screws.",
  "Weld 3/16″ bracket plates P33 to each end wall on 1″ spacers so the shelf hardware sits off the hot wall.",
  "Mount folding shelf brackets rated 100 lb or more per pair. Shelf top sits at grate height or 1″ below.",
  "Add a 1/2″ round utensil bar under each shelf's front edge with S-hooks.",
  "Load test each shelf with 50 lb."],
 tools:["Press brake","MIG welder","Rivet gun (stainless rivets)","Drill","50 lb test weight"],
 ppe:["glasses","helmet","gloves","cut","boots"],
 haz:["Press brake is a crush point. Use two-hand controls and keep fingers out of the die."],
 qc:["Shelves fold flat and lock open","50 lb load test passed with no sag"]},

{id:"27", p:"p6", hrs:1.5, crew:"Fitter", title:"Final fit-out details",
 goal:"Nothing on the pit can catch skin or clothing, and it's identified and photographed.",
 steps:[
  "Rivet the serial/ID plate to the right end of the stand and log the number.",
  "Round and grind every exposed corner and edge.",
  "Fit tow handle grips and check the drain plug threads.",
  "Walk the whole pit running a gloved hand over every edge.",
  "Photograph the bare-metal build for the job file."],
 tools:["Angle grinder","Flap discs","Files","Rivet gun","Camera / phone"],
 ppe:["glasses","faceshield","gloves","hearing"],
 haz:[],
 qc:["No sharp edges anywhere","Serial plate installed and logged"]},

/* ---------- P7 ---------- */
{id:"28", p:"p7", hrs:2, crew:"Finisher", title:"Surface prep for paint",
 goal:"The exterior is clean and ready for high-heat paint, and everything that shouldn't be painted is masked.",
 steps:[
  "Grind spatter and blend visible exterior welds with 80 grit.",
  "Remove loose mill scale and rust from the exterior with flap discs or wire cups. Loose scale is where high-heat paint peels.",
  "Mask the interior, lid interiors, grate ledges, thermometers, hinge pins, all stainless, casters, and handles.",
  "Blow off dust, then wipe with wax and grease remover and let it flash off."],
 tools:["Angle grinder","80 grit flap discs","Wire cup brushes","High-heat masking tape and paper","Wax and grease remover"],
 ppe:["glasses","faceshield","gloves","hearing","resp"],
 haz:[],
 qc:["Exterior clean and dry","Masking complete"]},

{id:"29", p:"p7", hrs:2, crew:"Finisher", title:"Paint the exterior",
 goal:"An even coat of 1200°F-rated paint on the exterior only.",
 steps:[
  "Paint in the booth or a well-ventilated area with no hot work nearby.",
  "Apply 2–3 light coats of 1200°F high-heat paint to the exterior only, following the can's recoat window.",
  "Do not paint the interior, lid interiors, grates, or any food-contact surface.",
  "Pull masking when the paint is firm but not fully hard.",
  "Note the manufacturer's heat-cure schedule (often stepped) on the traveler. It gets done during burn-in."],
 tools:["HVLP gun or high-heat aerosol","Paint booth / ventilation","Tack cloth"],
 ppe:["glasses","resp","nitrile"],
 haz:["Paint vapor is flammable and toxic. Organic-vapor respirator on, and no grinding, welding, or open flame in the area while painting and drying."],
 qc:["Even coverage with no runs","No paint on any interior or food surface"]},

{id:"30", p:"p7", hrs:3.5, crew:"Lead + helper", title:"Burn-in and seasoning (outdoors)",
 goal:"Paint is heat-cured, mill oil is burned off, and the interior has a seasoned, rust-resistant coat.",
 steps:[
  "Move the pit outdoors, at least 10 ft from buildings and anything that burns.",
  "Wash the interior with hot water and degreaser to remove cutting oil and marker. Rinse and dry with a small fire.",
  "Set the trays at 10″. Light natural lump charcoal with a chimney starter (no lighter fluid during burn-in).",
  "Run 400–500°F for 1–2 hours with lids closed and dampers open. This cures the paint and burns off mill oil.",
  "Cool to warm. Wipe the interior, lid interiors, and grates with a thin coat of high-smoke-point cooking oil (canola or vegetable).",
  "Heat to 300–350°F for 1 hour. Repeat the oil-and-heat cycle two more times."],
 tools:["Lump charcoal and chimney starter","Degreaser and hose","Cooking oil and lint-free rags","IR thermometer","Long tongs"],
 ppe:["heat","glasses","boots"],
 haz:["Outdoors only. Burning charcoal makes carbon monoxide, which can kill in an enclosed shop.",
      "Surfaces pass 500°F. High-heat gloves and long tools; keep an extinguisher and a charged hose at hand."],
 qc:["Paint cured with no peeling or bubbling","Interior evenly seasoned, dark and slick"]},

/* ---------- P8 ---------- */
{id:"31", p:"p8", hrs:2, crew:"Lead", title:"Temperature map and performance test",
 goal:"Prove both zones hold steady heat, dampers control it, and the seams don't leak smoke.",
 steps:[
  "Fire both zones with trays at 10″. Target 300°F on the lid thermometers.",
  "Place thermocouple probes at the four corners and center of each zone at grate level.",
  "At steady state, record readings every 10 minutes for 30 minutes.",
  "Close the intakes to about 25%. Temperature should drop noticeably within 15–20 minutes.",
  "Smoke test with lids closed. Some smoke at lid gaps is normal; weld seams should not leak.",
  "Record results and any hot spots on the traveler for the owner's guide."],
 tools:["Multi-channel thermocouple meter","IR thermometer","Lump charcoal","Traveler"],
 ppe:["heat","glasses","boots"],
 haz:["Outdoors only, same as burn-in."],
 qc:["Spread within each zone 35°F or less","Dampers clearly control temperature","No smoke leaking from weld seams"]},

{id:"32", p:"p8", hrs:1, crew:"Lead + QC", title:"Final inspection",
 goal:"The pit meets the signed spec and is safe to hand over.",
 steps:[
  "Dimensions match the signed spec: overall size, grate height, lid fit.",
  "All welds pass visual: no cracks, porosity, lack of fusion, or heavy spatter.",
  "Lids: lift force, stay-open, stops, and greased hinge pins.",
  "Dampers, cleanout door, and drain plug all work.",
  "Casters torqued, brakes lock, and the pit rolls straight.",
  "Stability: push test at shelf height with a shelf loaded. No tipping.",
  "Labels on: HOT SURFACE, OUTDOOR USE ONLY with carbon monoxide warning, keep clear of combustibles, and the serial plate."],
 tools:["Tape","Fillet gauge","Fish scale","Labels","Camera / phone"],
 ppe:["glasses","gloves"],
 haz:[],
 qc:["Lead fabricator sign-off","Final photos in the job file"]},

{id:"33", p:"p8", hrs:1, crew:"Lead", title:"Documentation and customer handoff",
 goal:"The customer leaves knowing how to run the pit safely, with a complete record of the build.",
 steps:[
  "Complete the traveler: material certs, weld settings, test results, serial number, crew sign-offs.",
  "Prepare the owner's guide: lighting, damper control, coal-tray heights, ash cleanout, cleaning, re-seasoning, rust care, extinguisher recommendation, and clearances.",
  "Pack the starter kit: two grate hooks, all leg sets, spare hitch pins, touch-up paint.",
  "Walk the customer through operation and safety in person.",
  "Remind the customer to confirm health department and fire marshal requirements before vending.",
  "Load out: strap through the stand frame (never the lids or shelves), casters locked, wheels chocked."],
 tools:["Traveler and job file","Owner's guide","Starter kit","Ratchet straps and chocks"],
 ppe:["gloves","boots"],
 haz:[],
 qc:["Customer signed acceptance","Job file closed"]}
];

/* ---------- reference data ---------- */
const TOOLS = [
 {g:"Cutting", items:[
  ["Plasma cutter, 45–65A (or CNC plasma table)","Body panels, openings, lid holes","Tip and electrode wear, air dry and at pressure, ground clamp tight"],
  ["Cold saw or horizontal bandsaw","Angle, tube, flat bar, rod","Blade sharp, coolant, vise clamps work"],
  ["Angle grinders, 4-1/2″ and 7″","Cutoff, dross, weld blending","Guard on, handle on, wheel RPM ≥ tool RPM"],
  ["Mag drill with annular cutters / step bits","Drain, thermometer, caster holes","Magnet holds, safety strap fitted"],
  ["Press brake (or hand brake)","Shelf top turn-downs","Two-hand controls and guards working"]]},
 {g:"Layout & measuring", items:[
  ["25 ft tape, framing square, combination square","Layout and square checks","Tape hook not bent"],
  ["48″ straightedge, level","Panel layout, ledge heights","Straight, level vial readable"],
  ["Calipers, fillet gauges","Material and weld size checks","Zeroed, batteries"],
  ["Soapstone, paint markers, scribe, center punch","Marking","Stocked"]]},
 {g:"Fixturing & lifting", items:[
  ["Flat steel weld table","Square, flat assembly","Clean, spatter-free, flat"],
  ["Magnetic squares, C-clamps, F-clamps, locking clamps, bar clamps","Holding fit-up","Jaws and threads in good shape"],
  ["Porta-power or ratchet strap","Racking the box square","Hoses not leaking"],
  ["Overhead hoist / forklift, plate clamps, rated slings, spreader, tag lines","Moving sheets, body, finished pit","Rated tags readable, no cuts or kinks, inspection current"]]},
 {g:"Welding", items:[
  ["MIG welder 250A+, ER70S-6 .035″, 75/25 gas","All carbon steel welding","Liner clean, contact tip good, gas flow 25–30 CFH"],
  ["TIG welder, ER308L, 100% argon, 2% lanthanated tungsten","Stainless grates","Torch and cables intact, gas lens"],
  ["Fume extractor","Weld fume at the arc","Filter loaded, airflow strong"],
  ["Welding screens and fire blankets","Protect bystanders and combustibles","No holes or burn-through"]]},
 {g:"Finishing", items:[
  ["Flap discs 40/60/80, wire cups (carbon and stainless-only)","Prep and blending","Keep stainless brushes separate and labeled"],
  ["Weld cleaner or pickling paste","Stainless heat-tint removal","SDS posted, neutralizer ready"],
  ["HVLP gun or high-heat aerosol, paint booth","Exterior paint","Booth fans and filters working"],
  ["Rivet gun, drill, taps (1/4-20, 3/8-16), 3/4″ NPT plug","Shelves, stops, drain","Bits sharp"]]},
 {g:"Testing", items:[
  ["Multi-channel thermocouple meter and probes","Temperature map","Probes read room temp"],
  ["Infrared thermometer","Surface temps during burn-in","Battery"],
  ["Fish scale","Lid lift force","Reads zero unloaded"]]},
 {g:"Safety equipment", items:[
  ["ABC fire extinguishers (2+)","Hot work and burn-in","Tagged, in date, pin in place"],
  ["First-aid kit, burn gel, eyewash station","Injuries","Stocked, eyewash flushed weekly"],
  ["Hot-work permits","Every hot-work shift","Posted and signed"]]}
];

const BOM = [
 ["3/16″ A36 hot-rolled plate, 48″ × 96″","2 sheets + drop","Body panels, cleanout door, dampers, tabs"],
 ["10 ga hot-rolled sheet, 48″ × 96″","2 sheets","Lids"],
 ["2″ × 2″ × 3/16″ angle","10 ft","Grate ledges"],
 ["1-1/2″ × 1-1/2″ × 3/16″ angle","40 ft","Lid landing (15 ft) and coal-tray frames (25 ft)"],
 ["2″ × 2″ × 3/16″ square tube","24 ft","Stand frame and legs"],
 ["3″ × 1/4″ and 2″ × 1/4″ flat bar","3 ft each","Center cap and web"],
 ["1/4″ × 1″ and 1/4″ × 1/2″ flat bar","8 ft each","Damper guides"],
 ["1″ × 1/8″ flat bar","12 ft","Lid stiffeners"],
 ["3/8″ round bar (A36/1018)","140 ft","Coal-tray bars, handle standoffs, hooks"],
 ["1/2″ round bar","12 ft","Pulls, lift loops, utensil bars"],
 ["1″ × 14 ga and 3/4″ × 11 ga square tube","3 ft / 12 ft","Coal-tray leg sleeves and legs"],
 ["1″ × 1″ × 1/8″ square tube","5 ft","Counterweight arms"],
 ["1/2″ plate","1 sq ft","Counterweights"],
 ["3/8″ plate","1 sq ft","Caster plates"],
 ["304 stainless 3/8″ round","130 ft","Cooking grate rods"],
 ["304 stainless 1/4″ × 1″ flat bar","30 ft","Cooking grate frames"],
 ["304 stainless sheet, 16 ga","2 pcs 18″ × 30″","Shelf tops"],
 ["3″ schedule 40 pipe","3 ft","Stacks"],
 ["5/8″ weld-on bullet hinges","4 (+ 1 small pin hinge)","Lids and cleanout door"],
 ["6″ polyurethane plate casters, 500 lb+ each","2 locking swivel, 2 rigid","Mobility"],
 ["3/8″ grade 8 bolts + nylon locknuts (plain or stainless)","16","Casters"],
 ["Folding shelf brackets, 100 lb+ per pair","4","Side shelves"],
 ["3″ dial thermometers, 50–550°F","2","Lids"],
 ["Hardwood handles 1-1/4″ (or stainless spring handles)","2","Lids"],
 ["3/4″ NPT half-coupling and steel plug","1","Drain"],
 ["Hitch pins 3/8″","12 + spares","Coal-tray legs"],
 ["High-heat paint, 1200°F rated","~2 qt or 6 aerosols","Exterior"],
 ["Labels: hot surface, outdoor use / CO warning, clearance, serial plate","1 set","Safety and ID"]
];

const CUT = [
 ["P1","Floor","3/16″ plate","1","60″ × 30″","Drain hole front-right"],
 ["P2","Front wall","3/16″ plate","1","60″ × 24″","Two 3″ × 10″ intakes"],
 ["P3","Back wall","3/16″ plate","1","60″ × 24″","Hinge tabs later"],
 ["P4","End wall","3/16″ plate","2","29-5/8″ × 24″","Left gets 18″ × 5″ cleanout"],
 ["P5","Cleanout door","3/16″ plate","1","19″ × 6″","Overlaps opening 1/2″"],
 ["P6","Damper slide","3/16″ plate","2","4-1/2″ × 12″",""],
 ["P7","Grate ledge","2″ × 2″ × 3/16″ angle","2","59-5/8″","Top at 22″"],
 ["P8","Center web","2″ × 1/4″ flat","1","29-5/8″","On edge"],
 ["P9","Center cap","3″ × 1/4″ flat","1","30″","Lids land here"],
 ["P10","Lid landing","1-1/2″ × 3/16″ angle","2 + 2","63″ / 33″","Mitered, outside perimeter"],
 ["P11","Hinge tab","3/16″ plate","4","2″ × 4″",""],
 ["P12","Lid top","10 ga","2","30-1/8″ × 30-1/2″","Nominal, fit to as-built"],
 ["P13","Lid front/back skirt","10 ga","4","30-1/8″ × 10″",""],
 ["P14","Lid outer end skirt","10 ga","2","30-1/4″ × 10″","Fit between skirts"],
 ["P15","Lid inner end skirt","10 ga","2","30-1/4″ × 8-1/4″","Lands on cap"],
 ["P16","Counterweight arm","1″ × 1″ × 1/8″ tube","4","14″","Trim to suit"],
 ["P17","Counterweight","1/2″ plate","2","4″ × 6″","Tune on swing test"],
 ["P18","Stack","3″ sch 40 pipe","2","18″",""],
 ["P19","Stand long rail","2″ × 2″ × 3/16″ tube","2","60″",""],
 ["P20","Stand cross rail","2″ × 2″ × 3/16″ tube","4","26″",""],
 ["P21","Stand leg","2″ × 2″ × 3/16″ tube","4","6″","Grate lands ≈ 36″"],
 ["P22","Caster plate","3/8″ plate","4","4″ × 4-1/2″","Match casters"],
 ["P23","Tray frame long","1-1/2″ angle","6","29″","Mitered"],
 ["P24","Tray frame short","1-1/2″ angle","6","19-1/2″","Mitered"],
 ["P25","Tray bar","3/8″ round","54","28-1/2″","Stop block, fit to frame"],
 ["P26","Tray leg sleeve","1″ × 14 ga tube","12","2″",""],
 ["P27","Tray leg","3/4″ × 11 ga tube","36","≈5″ / 9″ / 13″","12 of each, cut to fit"],
 ["P28","Tray lift loop","1/2″ round","12","8″",""],
 ["P29","Grate frame","304 1/4″ × 1″ flat","8 + 8","29-1/4″ / 14-1/2″",""],
 ["P30","Grate rod","304 3/8″ round","≈108","14″","Fit inside frame"],
 ["P31","Shelf frame","1-1/4″ × 1/8″ angle","4 + 4","28″ / 16″",""],
 ["P32","Shelf top","16 ga 304","2","18″ × 30″ blank","1″ turn-down 3 sides"],
 ["P33","Shelf bracket plate","3/16″ plate","4","3″ × 10″","On 1″ spacers"],
 ["P34","Damper guide","1/4″ × 1″ + 1/4″ × 1/2″ flat","4 + 4","24″",""],
 ["P35","Handle standoff","3/8″ round","4","3″",""],
 ["P36","Tow handle","1″ sch 40 pipe","1","24″","Optional"]
];

/* Front elevation drawing */
function svgFront(){
  const s=7, x0=200, G=480;
  const casterY=G-21, legTop=G-42-42, railTop=legTop-14, floorY=railTop, top=floorY-24*s;
  const grate=floorY-22*s, land=top+1.5*s, lidTop=land-10*s, stackTop=lidTop-18*s;
  const W=60*s;
  const T = (x,y,t,a="start",cls="") => `<text x="${x}" y="${y}" text-anchor="${a}" class="${cls}">${t}</text>`;
  return `<svg viewBox="0 0 900 530" role="img" aria-label="Front elevation of the JP-60 jerk pit">
  <style>
   .o{fill:none;stroke:var(--ink);stroke-width:2}
   .f{fill:var(--panel2);stroke:var(--ink);stroke-width:2}
   .lid{fill:var(--panel);stroke:var(--ink);stroke-width:2}
   .d{stroke:var(--muted);stroke-width:1.2;stroke-dasharray:6 5;fill:none}
   .g{stroke:var(--marker);stroke-width:3;stroke-dasharray:10 4}
   .dim{stroke:var(--muted);stroke-width:1}
   text{font-family:var(--body);font-size:13px;fill:var(--ink)}
   .m{fill:var(--muted);font-size:12px}
   .h{font-family:var(--display);font-weight:700;font-size:18px}
   .fire{fill:var(--red);opacity:.18}
  </style>
  ${T(20,30,"Front elevation","start","h")}
  ${T(20,50,"Nominal, scale ≈ 1:14","start","m")}
  <line x1="40" y1="${G}" x2="860" y2="${G}" class="dim"/>
  <!-- stacks -->
  <rect x="${x0+105-12}" y="${stackTop}" width="24.5" height="${18*s}" class="f"/>
  <rect x="${x0+315-12}" y="${stackTop}" width="24.5" height="${18*s}" class="f"/>
  <!-- lids -->
  <rect x="${x0-2}" y="${lidTop}" width="${W/2+1}" height="${10*s}" class="lid"/>
  <rect x="${x0+W/2+1}" y="${lidTop}" width="${W/2+1}" height="${10*s}" class="lid"/>
  <rect x="${x0+105-42}" y="${lidTop+14}" width="84" height="8" rx="4" class="f"/>
  <rect x="${x0+315-42}" y="${lidTop+14}" width="84" height="8" rx="4" class="f"/>
  <circle cx="${x0+105}" cy="${land-28}" r="9" class="o"/><circle cx="${x0+315}" cy="${land-28}" r="9" class="o"/>
  <!-- body -->
  <rect x="${x0}" y="${land}" width="${W}" height="${floorY-land}" class="f"/>
  <rect x="${x0}" y="${floorY-14*s-6}" width="${W}" height="${14*s-30}" class="fire"/>
  <line x1="${x0}" y1="${grate}" x2="${x0+W}" y2="${grate}" class="g"/>
  ${[6,10,14].map(h=>`<line x1="${x0+6}" y1="${floorY-h*s}" x2="${x0+W-6}" y2="${floorY-h*s}" class="d"/>`).join("")}
  <rect x="${x0+70}" y="${floorY-4.5*s}" width="70" height="${3*s}" class="o"/>
  <rect x="${x0+280}" y="${floorY-4.5*s}" width="70" height="${3*s}" class="o"/>
  <!-- shelves -->
  <rect x="${x0-112}" y="${grate}" width="112" height="9" class="f"/>
  <rect x="${x0+W}" y="${grate}" width="112" height="9" class="f"/>
  <line x1="${x0-90}" y1="${grate+9}" x2="${x0}" y2="${grate+70}" class="o"/>
  <line x1="${x0+W+90}" y1="${grate+9}" x2="${x0+W}" y2="${grate+70}" class="o"/>
  <!-- stand -->
  <rect x="${x0}" y="${railTop}" width="${W}" height="14" class="f"/>
  <rect x="${x0}" y="${railTop+14}" width="14" height="42" class="f"/>
  <rect x="${x0+W-14}" y="${railTop+14}" width="14" height="42" class="f"/>
  <circle cx="${x0+7}" cy="${casterY}" r="21" class="o"/><circle cx="${x0+W-7}" cy="${casterY}" r="21" class="o"/>
  <!-- labels -->
  ${T(x0+W+118,grate-14,"Grate at 22″")}${T(x0+W+118,grate+28,"(steel grates or","start","m")}${T(x0+W+118,grate+44,"pimento sticks)","start","m")}
  ${T(x0+W/2,floorY-12*s+4,"Coal tray heights 6″ / 10″ / 14″","middle","m")}
  ${T(x0+W/2,floorY-2.2*s,"Sliding intakes 3″ × 10″","middle","m")}
  ${T(x0+140,stackTop+30,"3″ stack + damper")}
  ${T(x0+140,stackTop+50,"Two counterweighted lids, 10″ skirts","start","m")}
  ${T(x0-112,grate-8,"Fold-down 304 shelf")}
  ${T(x0+122,land-24,"Thermometer","start","m")}
  ${T(x0+W/2,railTop+30,"Stand 2″ × 2″ × 3/16″ tube, 6″ casters","middle","m")}
  <!-- dims -->
  <line x1="${x0}" y1="${G+18}" x2="${x0+W}" y2="${G+18}" class="dim"/>
  <line x1="${x0}" y1="${G+10}" x2="${x0}" y2="${G+26}" class="dim"/><line x1="${x0+W}" y1="${G+10}" x2="${x0+W}" y2="${G+26}" class="dim"/>
  ${T(x0+W/2,G+34,"60″ body","middle")}
  <line x1="${x0+W+60}" y1="${G}" x2="${x0+W+60}" y2="${grate}" class="dim"/>
  ${T(x0+W+66,(G+grate)/2,"≈ 36″ working height")}
  <line x1="${x0-140}" y1="${G}" x2="${x0-140}" y2="${stackTop}" class="dim"/>
  ${T(x0-134,stackTop+140,"≈ 65″ overall","start")}
  <line x1="${x0-20}" y1="${land}" x2="${x0-20}" y2="${floorY}" class="dim"/>
  ${T(x0-26,(land+floorY)/2+40,"24″ body","end","m")}
  </svg>`;
}
