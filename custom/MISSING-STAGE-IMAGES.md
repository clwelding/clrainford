# Missing Mobile Stage Images - AI Generation Checklist

Page: https://clrainford.com/custom/mobile-stage.html
Drop finished files in `custom/img/stage/steps/` (step images) and `custom/img/stage/parts/` (part images).
Filename must match the ID exactly. Preferred format `.webp` (`.jpg` / `.png` also work).

## Suggested style prompt (prepend to every item)
> Clean technical illustration for a steel-fabrication build guide, a collapsible mobile concert stage trailer (about 40 ft x 24 ft folding deck, lifting towers, truss roof, fabric canopy). Realistic shop/industrial look, neutral light-grey background, no text or logos, consistent lighting and style across the set.

- Step images: landscape, about 1600x900 (16:9), show the work being done in the shop/field.
- Part images: square, about 800x800 (1:1), single item centered on a plain white background (they display on white and `object-fit: contain`).

Progress: tick each box as the file is added.


## Step images (13 missing)

- [ ] `steps/s01.webp` - Freeze requirements & open-items list
- [ ] `steps/s02.webp` - Commission engineering scope
- [ ] `steps/s04.webp` - Build the mass budget
- [ ] `steps/s05.webp` - Collect equipment weights & load data
- [ ] `steps/s06.webp` - Vendor RFQs, samples & availability quotes
- [ ] `steps/s07.webp` - Release-gate review & drawing package
- [ ] `steps/s08.webp` - Receive, trace & mark stock
- [ ] `steps/s09.webp` - Set up shop equipment & fixtures
- [ ] `steps/s10.webp` - Open master assembly & weld registers
- [ ] `steps/s26.webp` - Audio rigging interfaces
- [ ] `steps/s27.webp` - Deck surfacing, stairs, rails & edge protection
- [ ] `steps/s28.webp` - Assemble accessories & first-use kit
- [ ] `steps/s31.webp` - Issue as-builts, load charts & training records

## Part images (102 unique missing)

Shared items appear once; 'Used in' shows the steps that reference them.

- [ ] `parts/req-sheet.webp` - Requirements sheet (Spec §1) - used in s01
- [ ] `parts/open-items.webp` - Open-items register (Spec §15) - used in s01
- [ ] `parts/laptop.webp` - Computer / shared folder - used in s01, s02, s04, s05, s06, s07, s10, s31
- [ ] `parts/printer.webp` - Printer for drawing sets - used in s01
- [ ] `parts/eng-scope.webp` - Engineering scope letter - used in s02
- [ ] `parts/rfp-pack.webp` - Proposal request package - used in s02
- [ ] `parts/gen-arr.webp` - General arrangement drawing - used in s03
- [ ] `parts/fold-env.webp` - Folded envelope drawing - used in s03
- [ ] `parts/motion-study.webp` - Motion study - used in s03
- [ ] `parts/cad.webp` - CAD / motion software - used in s03
- [ ] `parts/mass-sheet.webp` - Mass budget spreadsheet - used in s04
- [ ] `parts/speaker-data.webp` - Speaker / array data sheets - used in s05
- [ ] `parts/weight-sched.webp` - Signed equipment weight schedule - used in s05
- [ ] `parts/rig-hw-list.webp` - Rigging hardware list - used in s05
- [ ] `parts/rfq-form.webp` - RFQ form - used in s06
- [ ] `parts/fabric-samples.webp` - Canopy fabric samples - used in s06
- [ ] `parts/deck-samples.webp` - Deck panel samples - used in s06
- [ ] `parts/hinge-proposals.webp` - Hinge system proposals - used in s06
- [ ] `parts/struct-calcs.webp` - Sealed structural calculations - used in s07
- [ ] `parts/shop-drawings.webp` - Released shop drawings - used in s07
- [ ] `parts/cut-list.webp` - Released cut list - used in s07
- [ ] `parts/weld-sched.webp` - Weld schedule - used in s07
- [ ] `parts/hss-a500.webp` - ASTM A500 Gr C HSS (or A1085 only if specified) - used in s08
- [ ] `parts/plate-a572.webp` - ASTM A572 Gr 50 plate (A36 only if engineer approves) - used in s08
- [ ] `parts/mill-certs.webp` - Mill certificates - used in s08
- [ ] `parts/paint-marker.webp` - Marking paint / stamps - used in s08
- [ ] `parts/tape.webp` - Calibrated tape measures - used in s08, s13, s17, s18, s22, s27, s30
- [ ] `parts/scale.webp` - Shop scale / weigh gear - used in s08, s19, s30
- [ ] `parts/stock-rack.webp` - Stock racks - used in s08
- [ ] `parts/layout-table.webp` - Flat layout table / strongback - used in s09, s11, s14
- [ ] `parts/jig-stops.webp` - Fixture stops & clamps - used in s09, s14
- [ ] `parts/mig-welder.webp` - Welding machines (GMAW / GTAW) (steel and aluminum) - used in s09, s11, s12, s14, s15, s16, s18, s19
- [ ] `parts/cold-saw.webp` - Cold saw / band saw - used in s09, s13, s18
- [ ] `parts/drill-press.webp` - Mag drill / drill press - used in s09, s13, s15, s27
- [ ] `parts/crane.webp` - Overhead crane / lifting gear - used in s09, s11, s14, s17, s19, s20, s21, s26
- [ ] `parts/ppe.webp` - PPE: helmet, gloves, respirator, glasses - used in s09, s14
- [ ] `parts/fire-ext.webp` - Fire extinguisher & weld screens - used in s09
- [ ] `parts/squares.webp` - Squares, levels, laser level - used in s09, s11, s13, s16, s17, s20, s21
- [ ] `parts/assy-register.webp` - Master assembly register - used in s10
- [ ] `parts/weld-register.webp` - Weld register - used in s10
- [ ] `parts/wps-pqr.webp` - WPS / PQR & welder qualifications - used in s10
- [ ] `parts/hitch.webp` - Hitch / gooseneck / kingpin assembly - used in s12
- [ ] `parts/axles.webp` - Axles & suspension - used in s12
- [ ] `parts/brakes.webp` - Brakes - used in s12
- [ ] `parts/lighting-harness.webp` - Lighting & wiring - used in s12
- [ ] `parts/spare.webp` - Spare tire - used in s12
- [ ] `parts/travel-restraints.webp` - Transport restraints - used in s12
- [ ] `parts/cert-plate.webp` - Identification / certification plate - used in s12
- [ ] `parts/torque-wrench.webp` - Calibrated torque wrench - used in s12, s15, s20, s21, s23, s26
- [ ] `parts/jack-stands.webp` - Jack stands & lifts - used in s12
- [ ] `parts/dk-hss.webp` - HSS frame members (Engineer sets section & wall) - used in s13
- [ ] `parts/dk-plate.webp` - Connection plates (A572 Gr 50) - used in s13
- [ ] `parts/dk-frame.webp` - Deck frame sub-assemblies - used in s14
- [ ] `parts/line-bore.webp` - Line-boring / reaming setup - used in s15
- [ ] `parts/trial-supports.webp` - Temporary positive supports - used in s17
- [ ] `parts/trial-rigging.webp` - Test slings / hoists - used in s17
- [ ] `parts/ou-ballast.webp` - Engineered ballast attachment points - used in s19
- [ ] `parts/tw-tower.webp` - Lifting tower assemblies (Match lifting & truss system) - used in s20
- [ ] `parts/tw-lock.webp` - Tower locks - used in s20
- [ ] `parts/rf-truss.webp` - Entertainment trusses (Buy an engineered system; account for welded strength) - used in s21
- [ ] `parts/rf-conn.webp` - Truss connection hardware - used in s21
- [ ] `parts/cn-fabric.webp` - Coated canopy fabric (Strength, seam, weathering, flame-test documents) - used in s22
- [ ] `parts/cn-attach.webp` - Engineered distributed attachments - used in s22
- [ ] `parts/cn-flame.webp` - Flame-propagation test documents - used in s22
- [ ] `parts/sewing-weld.webp` - Seam welding / sewing equipment - used in s22
- [ ] `parts/tension-gauge.webp` - Tension gauge - used in s22
- [ ] `parts/hy-cyl.webp` - Rated cylinders (Specify model, pressure, force, stroke) - used in s23
- [ ] `parts/hy-pump.webp` - Pump / motor / reservoir / filtration - used in s23
- [ ] `parts/hy-manifold.webp` - Control manifold, relief & counterbalance - used in s23
- [ ] `parts/flush-rig.webp` - Fluid flush / filtration cart - used in s23
- [ ] `parts/el-panel.webp` - Control panel / enclosure - used in s24
- [ ] `parts/el-power.webp` - Shore power / battery & charger - used in s24
- [ ] `parts/el-disc.webp` - Labeled disconnects - used in s24
- [ ] `parts/multimeter.webp` - Multimeter / insulation tester - used in s24, s25
- [ ] `parts/crimp.webp` - Crimp & termination tools - used in s24
- [ ] `parts/cx-supports.webp` - Positive supports / cribbing - used in s25
- [ ] `parts/cx-barriers.webp` - Exclusion-zone barriers - used in s25
- [ ] `parts/radios.webp` - Radios - used in s25, s29
- [ ] `parts/rg-frames.webp` - Approved flying frames (Working-load limits & traceability) - used in s26
- [ ] `parts/rg-hoist.webp` - Rated hoists (Working-load limits & traceability) - used in s26
- [ ] `parts/rg-points.webp` - Designed pick points - used in s26
- [ ] `parts/rg-chart.webp` - Point-load & combined-load chart - used in s26
- [ ] `parts/ac-deck.webp` - Rated deck panels / structural plywood (Rating, thickness, fastening pattern pending) - used in s27
- [ ] `parts/ac-antislip.webp` - Anti-slip surface - used in s27
- [ ] `parts/acc-mats.webp` - Support mats (Select from calculated ground reactions) - used in s28
- [ ] `parts/acc-chocks.webp` - Wheel chocks - used in s28
- [ ] `parts/acc-level.webp` - Level / survey tools - used in s28
- [ ] `parts/acc-weather.webp` - Weather monitoring equipment - used in s28
- [ ] `parts/acc-pins.webp` - Lock / pin inventory - used in s28
- [ ] `parts/acc-barriers.webp` - Deployment barriers - used in s28
- [ ] `parts/acc-toolbox.webp` - Tool storage - used in s28
- [ ] `parts/acc-kit.webp` - First-use inspection kit - used in s28
- [ ] `parts/acc-wear.webp` - Replacement wear parts - used in s28
- [ ] `parts/cx-plan.webp` - Written test plan - used in s29
- [ ] `parts/cx-instr.webp` - Instrumentation - used in s29
- [ ] `parts/cx-weights.webp` - Certified test weights - used in s29
- [ ] `parts/cx-weigh-ticket.webp` - Weigh tickets - used in s30
- [ ] `parts/doc-asbuilt.webp` - As-built drawings - used in s31
- [ ] `parts/doc-loadcharts.webp` - Operating load charts - used in s31
- [ ] `parts/doc-weather.webp` - Weather plan - used in s31
- [ ] `parts/doc-maint.webp` - Maintenance & inspection instructions - used in s31
- [ ] `parts/doc-training.webp` - Training records - used in s31
