// This hook runs right after PocketBase initializes, but before it starts accepting requests
onAfterBootstrap((e) => {
    const dao = $app.dao();

    try {
        // Try to find the collection. If it exists, this does nothing and moves on.
        dao.findCollectionByNameOrId("photos");
        console.log("✅ [init] 'photos' collection already exists.");
    } catch (err) {
        // If it throws an error, the collection doesn't exist yet, so we build it.
        console.log("⏳ [init] 'photos' collection not found. Creating it now...");

        const collection = new Collection({
            name: "photos",
            type: "base",
            // Empty strings mean "Public Access"
            listRule: "",
            viewRule: "",
            createRule: "",
            updateRule: null, // null means "Admin Only"
            deleteRule: null,
            schema: [
                {
                    name: "image",
                    type: "file",
                    required: true,
                    options: {
                        maxSelect: 1,
                        maxSize: 52428800, // 50MB max
                        mimeTypes: ["image/jpeg", "image/jpg"],
                        thumbs: ["400x0"]
                    }
                },
                { name: "camera", type: "text" },
                { name: "lens", type: "text" },
                { name: "aperture", type: "text" },
                { name: "shutter_speed", type: "text" },
                { name: "iso", type: "text" } // Or "number" if you prefer
            ]
        });

        try {
            dao.saveCollection(collection);
            console.log("[init] 'photos' collection created successfully!");
        } catch (saveErr) {
            console.error("[init] Failed to create 'photos' collection:", saveErr);
        }
    }
});