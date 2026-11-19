# Blender

How to make or prepare 3D assets through a Blender connection, when one is
available. Nothing in this repository switches Blender on or off: you have
it in a session where a Blender MCP server is connected, and you do not
where it is not.

## Do you have it?

Look at your own tools. A Blender MCP server gives you a way to run Python
in Blender, to look at the result, and to read the scene; some also search
asset libraries and generate models. Tool names differ between servers, so
go by what they do. If the server has a status tool, call it once: it tells
you the Blender version and which libraries and generators are switched on.

Without a connection, do not ask the user to install one in the middle of a
project. The other routes still work: a `.glb` the client supplies, a model
the user downloads themselves, or a recipe that needs no model (see the
concept director's table). Record in the concept which route you took.

## Three rules

### 1. It is the user's live Blender

The connection runs code in the Blender that is open on the user's machine,
with whatever they were working on.

- **Ask before the first use** in a project: say what you are about to make
  and that it will happen in their open Blender. Wait for a yes.
- **Read the scene first.** If a file is open with work in it, or the scene
  has unsaved changes, tell the user and ask them to save and open a new
  file. Do not decide that for them.
- **Work in your own collection**, named `studio-<project>`. Create every
  object, light and camera you need inside it.
- **Never delete, move or edit anything outside that collection.** Not the
  default cube either, if it was there before you.
- **Never save the user's file** and never save over one. You export; they
  decide what to keep.
- **Leave it tidy.** When you finish, say what you added and offer to remove
  your collection.

### 2. A generated model spends the user's credit

Some servers can generate a textured model from a text or an image. It takes
a minute or more and may cost the user a credit with the generator.

1. Tell the user which generator the status tool shows as on, what you will
   ask it for, and how many attempts you plan (two is a sensible first ask).
2. On their yes:

   ```bash
   node tools/studio.mjs model-budget <project> --max <n> --approved "<what they said>"
   ```

3. **Before each attempt**, take one out of the budget:

   ```bash
   node tools/studio.mjs model-reserve <project> --what "<the object>"
   ```

   The tool refuses when there is no budget or it is used up. Raising it is
   a new question to the user.
4. Ask for **one object**, described by shape, material and colour. A
   generator does not make a scene, a ground plane, or parts to assemble.
5. Look at what came back before you build on it. A bad result is a used
   attempt, not a reason to keep generating quietly.

The assets stage checks this: a manifest that lists more generated models
than were reserved is refused.

A generated model never stands in for the client's actual product. For a
real product, the model comes from the client, from a scan, or is built to
their measurements and photographs, with their approval of the result.

### 3. A library asset comes with a licence

A model, texture or HDRI from an asset library belongs to someone.

- Read the licence on the asset's own page before you import it.
- **Usable:** public domain (CC0), and licences that allow commercial use
  and changes (CC-BY and similar), with the credit they ask for.
- **Not usable** on a business's site: anything non-commercial (NC) or
  no-derivatives (ND), "editorial use only", and anything whose licence you
  cannot find. Compressing and converting the file is a change.
- Record it in `assets_manifest.json`: `origin: "library"`, `licence`,
  `source_url`, `author`. The checkpoint refuses a library asset without
  them, and one with an NC or ND licence.
- A licence that asks for credit gets it on the site, and in the handoff.

## From a model to a `.glb` the platform loads

Read `skills/core/webto-3d-effects/references/recipes.md` first; it is the
authority on what the platform's 3D runtime supports. In short:

1. **Size the object.** Imported and generated models arrive at any scale.
   Read the object's bounding box and scale it to its real size in metres,
   with its base at the origin. Apply the scale.
2. **Materials: Principled BSDF only.** That is what glTF carries. Find the
   shader node by its type, never by its name (names are translated), and
   set colours on the node's inputs.
3. **Keep it light.** Decimate dense meshes; textures at 1024 to 2048 px;
   JPEG or WebP for colour maps. Aim for 1 to 3 MB.
4. **Export only your objects** as one binary file, modifiers applied, with
   Draco compression, into the bundle's `assets/` folder (give Blender the
   absolute path):

   ```python
   bpy.ops.export_scene.gltf(
       filepath=r"<absolute path>/projects/<project>/site/assets/<name>.glb",
       export_format="GLB",
       use_selection=True,
       export_apply=True,
       export_draco_mesh_compression_enable=True,
   )
   ```

   These property names were read from Blender 5.3. On another version,
   list the operator's properties
   (`bpy.ops.export_scene.gltf.get_rna_type().properties`) instead of
   guessing, and read enum values from the property rather than typing them
   from memory.
5. **Inspect what you exported:**

   ```bash
   node tools/studio.mjs glb <project> <name>.glb
   ```

   It reports size, triangles, materials, compression and textures, and
   names what would stop the model from loading: above 10 MB, KTX2
   textures, or anything kept outside the file. Fix every PROBLEM; weigh
   every piece of advice.
6. **Still too big, or a model from elsewhere?** Shrink it with glTF
   Transform, exactly as the core skill shows (`optimize` with Draco and
   WebP textures, `resize` for textures). Never KTX2. Inspect again.
7. **Make the poster.** Render a still of the same object in the pose the
   section opens on, lit the way the page's direction asks, as JPG or WebP
   under 2 MB, into `assets/`. This image is the whole section for the
   editor, for thumbnails and for visitors who asked for reduced motion.
8. **Look.** Use the server's own way to see the viewport or a render after
   each step that changes the picture. A script that ran without an error
   has not shown you the model.

For a scroll-scrubbed video or a depth pass, the render settings and the
ffmpeg command are in the core skill's recipes.

## Record it

Every shipped file goes into `assets_manifest.json` with its `origin`:

| `origin` | Means | Also needs |
|---|---|---|
| `supplied` | The client's own file | `rights: "own"` |
| `library` | From an asset library | `licence`, `source_url`, `rights: "licensed"` |
| `ai-generated` | Made by a generator | `made_with`, `rights: "generated"`, a reservation |
| `modelled` | Built by hand or by script in this session | |
| `rendered` | A render or frame of another file listed here | |
| `stock` | A stock photograph | its credit in `stock_images.json` |
