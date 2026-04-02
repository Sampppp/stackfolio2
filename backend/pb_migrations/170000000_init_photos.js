migrate((app) => {
    const collection = new Collection({
        name: "photos",
        type: "base",
        listRule: "",      // Public Read
        viewRule: "",      // Public Read
        createRule: null,  // Admin Only
        updateRule: null,  // Admin Only
        deleteRule: null,  // Admin Only
        
        // CRITICAL V0.23 FIX: 'schema' is now 'fields'
        fields: [
            {
                name: "image",
                type: "file",
                required: true,
                options: {
                    maxSelect: 1,
                    maxSize: 52428800, 
                    mimeTypes: ["image/jpeg", "image/jpg"],
                    thumbs: ["400x0", "0x800"] 
                }
            },
            { name: "camera", type: "text" },
            { name: "lens", type: "text" },
            { name: "aperture", type: "text" },
            { name: "shutter_speed", type: "text" },
            { name: "iso", type: "text" }, // Changed to text to safely handle weird EXIF strings
            { name: "width", type: "number" },
            { name: "height", type: "number" },
            
            // CRITICAL V0.23 FIX: We must explicitly define autodate fields so our UI can sort by them
            {
                name: "created",
                type: "autodate",
                onCreate: true,
                onUpdate: false
            },
            {
                name: "updated",
                type: "autodate",
                onCreate: true,
                onUpdate: true
            }
        ]
    });

    app.save(collection);
    console.log("🚀 [migration] 'photos' collection created with v0.23 fields.");

    try {
        const superusers = app.findCollectionByNameOrId("_superusers");
        const record = new Record(superusers);
        record.set("email", "temp.email@gmail.com");
        record.set("password", "temp.password");
        
        app.save(record);
        console.log("🔐 [migration] Default superuser account created.");
    } catch (err) {
        console.error("❌ [migration] Failed to create default superuser:", err);
    }

}, (app) => {
    try {
        const collection = app.findCollectionByNameOrId("photos");
        app.delete(collection);
    } catch (err) {}
    
    try {
        const record = app.findAuthRecordByEmail("_superusers", "temp.email@gmail.com");
        app.delete(record);
    } catch (err) {}
});