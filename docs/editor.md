# Level Editor (`/editor`)

## Layout

Three-column layout (all within `100dvh`, sidebars scroll, center grid fixed):
- **Left panel:** Saved levels list (click to load for editing), "New Level" button; admin/moderator users also see a "Firestore" toggle listing published levels
- **Center:** Tool palette (grouped: Basic, Ice, Power, Conveyors, Teleporters, Players, Boxes) + clickable grid with edge indicators
- **Right panel:** Level name, grid size, edges, options (trail collision + conveyor power requirements), object configs, boxes section, actions, JSON preview; admin/moderator users see a "Firestore Publish" section

On mobile (`< 900px`): tab-based layout — tabs switch between Levels / Grid / Settings panels.

## Painting Behaviour

- Click a cell with the same type as active tool → toggles to empty
- Drag always paints/erases following the action started on mousedown

## Save Flow

- Editing existing (`?id=X`): "Update" button saves immediately to Dexie
- New level: "Save" opens a dialog to choose insert position (1-based, blank = last)
- Validation: `generateLevelData` checks that every `teleporter_in_X` has a matching `teleporter_out_X` and vice versa; returns an error if any pair is incomplete

## Submit Flow (non-admin, non-anonymous users)

- "Gönder" button appears in the top bar when `!isAnonymous && !isModerator`
- Opens a dialog showing level name (from editor state) + creator name (read-only: `tag ?? displayName ?? email`) + optional note
- Calls `submitLevelRequest()` → writes to Firestore `levelRequests/` with `status: 'pending'`
- Grid is stored as `JSON.stringify(CellType[][])` — Firestore rejects nested arrays

## Admin Publish Flow (moderator/admin users)

- "Firestore Publish" section in right panel — choose part, click "Publish to Firestore" / "Update Firestore"
- Calls `publishLevel()` or `updateFirestoreLevel()` from `admin.ts`
- Grid is stored as `JSON.stringify(CellType[][])` (same encoding)

## Box Placement

- "Add Box" button in palette → new box enters placement mode
- Click any grid cell to place the box; placement mode exits automatically
- Right panel Boxes section: shows each box's position, "Place" button to re-place, requiresPower toggle, remove button
- `BoxDot` overlay renders box position on the editor grid

## Conveyor Power Requirements

- Options section shows a checklist for every conveyor cell in the current grid
- Checked = that conveyor requires power to be active (`conveyorPowerRequired` in saved level)

## Level Order in `/levels`

Up/down arrow buttons reorder. Only the single `levelOrder` record in Dexie is updated per move — no level records are touched. Levels page collapses to 3-column grid on mobile (Size + Order columns hidden).

## Admin Moderation (`/admin`)

Separate page, accessible only to `role === 'admin'`. Lists pending `levelRequests` from Firestore:
- Inline grid preview using `GameCell` components
- "Onayla" → part selector → `approveLevelRequest()` (batch write: creates `levels/` doc + updates `levelParts/` order + marks request approved)
- "Reddet" → optional note → `rejectLevelRequest()`
- Toast notification on action
