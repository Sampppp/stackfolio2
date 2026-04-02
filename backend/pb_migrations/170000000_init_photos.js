migrate((db) => {
    // This "up" function runs once to create the schema
    const dao = new Dao(db);

    const collection = new Collection({
        name: "photos",
        type: "base",
        listRule: "",
        viewRule: "",
        createRule: "",
        updateRule: null,
        deleteRule: "", // Set to blank (public) so your new frontend delete feature works!
        schema: [
            {
                name: "image",
                type: "file",
                required: true,
                options: {
                    maxSelect: 1,
                    maxSize: 52428800, // 50MB max
                    mimeTypes: ["image/jpeg", "image/jpg"],
                    // Generate both the masonry thumbnail and the high-res lightbox thumbnail
                    thumbs: ["400x0", "0x800"] 
                }
            },
            { name: "camera", type: "text" },
            { name: "lens", type: "text" },
            { name: "aperture", type: "text" },
            { name: "shutter_speed", type: "text" },
            { name: "iso", type: "number" },
            { name: "width", type: "number" },
            { name: "height", type: "number" }
        ]
    });

    dao.saveCollection(collection);
    console.log("🚀 [migration] 'photos' collection created successfully!");

}, (db) => {
    // This "down" function runs if you ever rollback the migration
    const dao = new Dao(db);
    try {
        const collection = dao.findCollectionByNameOrId("photos");
        dao.deleteCollection(collection);
    } catch (err) {
        // ignore if it doesn't exist
    }
});