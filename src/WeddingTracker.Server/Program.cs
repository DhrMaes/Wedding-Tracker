using System.IO.Compression;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = 150 * 1024 * 1024;
});

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();

var contentRoot = app.Environment.ContentRootPath;

var candidateFrontendPaths = new[]
{
    Path.Combine(contentRoot, "..", "WeddingTracker.App"),
    Path.Combine(contentRoot, "WeddingTracker.App"),
    Path.Combine(contentRoot, "wwwroot"),
    Path.Combine(AppContext.BaseDirectory, "wwwroot")
};

var frontendPath = candidateFrontendPaths.FirstOrDefault(Directory.Exists)
    ?? Path.Combine(contentRoot, "wwwroot");

if (!Directory.Exists(frontendPath))
{
    Directory.CreateDirectory(frontendPath);
}

var configuredUploads = builder.Configuration["WeddingTracker:UploadsDirectory"] ?? "uploads";
var uploadsPath = Path.IsPathRooted(configuredUploads)
    ? configuredUploads
    : Path.Combine(contentRoot, configuredUploads);

if (!Directory.Exists(uploadsPath))
{
    Directory.CreateDirectory(uploadsPath);
}

var defaultFileOptions = new DefaultFilesOptions
{
    FileProvider = new PhysicalFileProvider(frontendPath),
    RequestPath = ""
};
defaultFileOptions.DefaultFileNames.Clear();
defaultFileOptions.DefaultFileNames.Add("app.html");
defaultFileOptions.DefaultFileNames.Add("index.html");

app.UseDefaultFiles(defaultFileOptions);

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(frontendPath),
    RequestPath = ""
});

app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(uploadsPath),
    RequestPath = "/uploads"
});

// Helper: Extracts Base64 images to physical files in uploads/ and replaces them with clean /uploads/ paths
async Task<string> SanitizeAndExtractImagesAsync(string json, string targetUploadsDir)
{
    try
    {
        using var doc = JsonDocument.Parse(json);
        var dict = JsonSerializer.Deserialize<Dictionary<string, object>>(json) ?? new();

        if (dict.TryGetValue("thriftStore", out var thriftObj) && thriftObj is JsonElement thriftEl && thriftEl.ValueKind == JsonValueKind.Array)
        {
            var updatedThrift = new List<Dictionary<string, object>>();
            int index = 0;
            foreach (var item in thriftEl.EnumerateArray())
            {
                var itemDict = JsonSerializer.Deserialize<Dictionary<string, object>>(item.GetRawText()) ?? new();
                if (itemDict.TryGetValue("image", out var imgVal) && imgVal is JsonElement imgEl)
                {
                    var imgStr = imgEl.GetString() ?? "";
                    if (imgStr.StartsWith("data:image/"))
                    {
                        var match = Regex.Match(imgStr, @"data:image/(?<type>[a-zA-Z0-9\+]+);base64,(?<data>.+)");
                        if (match.Success)
                        {
                            var imgType = match.Groups["type"].Value.ToLowerInvariant();
                            if (imgType is "jpeg") imgType = "jpg";
                            var base64Data = match.Groups["data"].Value;
                            var bytes = Convert.FromBase64String(base64Data);

                            var itemId = itemDict.TryGetValue("id", out var idObj) ? idObj?.ToString() : null;
                            var cleanId = string.IsNullOrWhiteSpace(itemId) ? $"{index}" : string.Concat(itemId.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
                            var newFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{cleanId}.{imgType}";
                            var filePath = Path.Combine(targetUploadsDir, newFileName);

                            await File.WriteAllBytesAsync(filePath, bytes);
                            itemDict["image"] = $"/uploads/{newFileName}";
                        }
                    }
                }
                updatedThrift.Add(itemDict);
                index++;
            }
            dict["thriftStore"] = updatedThrift;
            return JsonSerializer.Serialize(dict, new JsonSerializerOptions { WriteIndented = true });
        }
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Sanitization error: {ex.Message}");
    }
    return json;
}

// --- API Endpoints ---

app.MapGet("/health", () => Results.Ok(new
{
    status = "healthy",
    service = "WeddingTracker.Server",
    utcTime = DateTimeOffset.UtcNow
}));

// Upload single image
app.MapPost("/api/upload", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "Verzoek moet multipart/form-data zijn." });
    }

    var form = await request.ReadFormAsync();
    var file = form.Files.GetFile("image") ?? form.Files.FirstOrDefault();

    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "Geen bestand ontvangen." });
    }

    var allowedExtensions = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg", ".avif", ".heic"
    };

    var ext = Path.GetExtension(file.FileName);
    if (string.IsNullOrEmpty(ext) || !allowedExtensions.Contains(ext))
    {
        return Results.BadRequest(new { error = $"Bestandstype '{ext}' is niet toegestaan." });
    }

    var rawName = Path.GetFileNameWithoutExtension(file.FileName);
    var cleanName = string.Concat(rawName.Where(c => char.IsLetterOrDigit(c) || c is '-' or '_'));
    if (string.IsNullOrWhiteSpace(cleanName)) cleanName = "photo";

    var uniqueFileName = $"{DateTime.UtcNow:yyyyMMdd_HHmmss}_{Guid.NewGuid().ToString("N")[..6]}_{cleanName}{ext.ToLowerInvariant()}";
    var destinationFilePath = Path.Combine(uploadsPath, uniqueFileName);

    await using (var stream = File.Create(destinationFilePath))
    {
        await file.CopyToAsync(stream);
    }

    return Results.Ok(new
    {
        url = $"/uploads/{uniqueFileName}",
        filename = uniqueFileName,
        originalName = file.FileName,
        sizeBytes = file.Length,
        uploadedAtUtc = DateTimeOffset.UtcNow
    });
});

// List Images
app.MapGet("/api/images", () =>
{
    if (!Directory.Exists(uploadsPath))
    {
        return Results.Ok(Array.Empty<object>());
    }

    var files = Directory.GetFiles(uploadsPath)
        .Select(f => new FileInfo(f))
        .OrderByDescending(f => f.CreationTimeUtc)
        .Select(f => new
        {
            filename = f.Name,
            url = $"/uploads/{f.Name}",
            sizeBytes = f.Length,
            createdUtc = f.CreationTimeUtc
        });

    return Results.Ok(files);
});

// Delete Image
app.MapDelete("/api/images/{filename}", (string filename) =>
{
    var safeFileName = Path.GetFileName(filename);
    var targetPath = Path.Combine(uploadsPath, safeFileName);

    if (!File.Exists(targetPath))
    {
        return Results.NotFound(new { error = "Afbeelding niet gevonden." });
    }

    try
    {
        File.Delete(targetPath);
        return Results.Ok(new { message = $"Afbeelding {safeFileName} verwijderd." });
    }
    catch (Exception ex)
    {
        return Results.Problem($"Kon bestand niet verwijderen: {ex.Message}");
    }
});

// --- Backup Endpoints (Combines Firestore Data + Server Images) ---

// Export: Extracts any Base64 images to uploads/, packages clean JSON + uploads/ into a .ZIP
app.MapPost("/api/backup/export", async (HttpRequest request) =>
{
    using var reader = new StreamReader(request.Body);
    var rawJsonPayload = await reader.ReadToEndAsync();

    if (string.IsNullOrWhiteSpace(rawJsonPayload))
    {
        return Results.BadRequest(new { error = "Geen data ontvangen voor export." });
    }

    // Convert any legacy Base64 images to actual files in uploads/ first!
    var cleanJsonPayload = await SanitizeAndExtractImagesAsync(rawJsonPayload, uploadsPath);

    var memoryStream = new MemoryStream();
    using (var archive = new ZipArchive(memoryStream, ZipArchiveMode.Create, leaveOpen: true))
    {
        // 1. Add clean database JSON (contains ONLY relative /uploads/... URLs)
        var jsonEntry = archive.CreateEntry("wedding-data.json", CompressionLevel.Optimal);
        await using (var entryStream = jsonEntry.Open())
        await using (var writer = new StreamWriter(entryStream))
        {
            await writer.WriteAsync(cleanJsonPayload);
        }

        // 2. Add all physical image files from uploads folder
        if (Directory.Exists(uploadsPath))
        {
            var imageFiles = Directory.GetFiles(uploadsPath);
            foreach (var imgPath in imageFiles)
            {
                var fileName = Path.GetFileName(imgPath);
                var imgEntry = archive.CreateEntry($"uploads/{fileName}", CompressionLevel.Optimal);
                await using var fs = File.OpenRead(imgPath);
                await using var entryStream = imgEntry.Open();
                await fs.CopyToAsync(entryStream);
            }
        }
    }

    memoryStream.Position = 0;
    var zipFileName = $"wedding-tracker-backup-{DateTime.UtcNow:yyyy-MM-dd}.zip";
    return Results.File(memoryStream, "application/zip", zipFileName);
});

// Import: Unpacks uploaded .ZIP (or legacy .JSON), restores server images, and returns clean data for Firestore
app.MapPost("/api/backup/import", async (HttpRequest request) =>
{
    if (!request.HasFormContentType)
    {
        return Results.BadRequest(new { error = "Verzoek moet multipart/form-data zijn." });
    }

    var form = await request.ReadFormAsync();
    var file = form.Files.FirstOrDefault();

    if (file == null || file.Length == 0)
    {
        return Results.BadRequest(new { error = "Geen backupbestand ontvangen." });
    }

    var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
    string jsonData = string.Empty;

    if (extension == ".zip")
    {
        await using var stream = file.OpenReadStream();
        using var archive = new ZipArchive(stream, ZipArchiveMode.Read);

        foreach (var entry in archive.Entries)
        {
            if (entry.FullName.Equals("wedding-data.json", StringComparison.OrdinalIgnoreCase))
            {
                using var streamReader = new StreamReader(entry.Open());
                jsonData = await streamReader.ReadToEndAsync();
            }
            else if (entry.FullName.StartsWith("uploads/", StringComparison.OrdinalIgnoreCase) && !string.IsNullOrEmpty(entry.Name))
            {
                var destPath = Path.Combine(uploadsPath, Path.GetFileName(entry.Name));
                using var entryStream = entry.Open();
                using var outStream = File.Create(destPath);
                await entryStream.CopyToAsync(outStream);
            }
        }
    }
    else if (extension == ".json")
    {
        using var streamReader = new StreamReader(file.OpenReadStream());
        var rawJson = await streamReader.ReadToEndAsync();

        // Extract any legacy embedded Base64 photos from JSON and save them as physical files
        jsonData = await SanitizeAndExtractImagesAsync(rawJson, uploadsPath);
    }
    else
    {
        return Results.BadRequest(new { error = "Upload een .zip of .json backupbestand." });
    }

    if (string.IsNullOrWhiteSpace(jsonData))
    {
        return Results.BadRequest(new { error = "Kon geen geldige data vinden in de backup." });
    }

    return Results.Content(jsonData, "application/json");
});

app.MapFallback(async context =>
{
    var appHtmlPath = Path.Combine(frontendPath, "app.html");
    if (File.Exists(appHtmlPath))
    {
        context.Response.ContentType = "text/html; charset=utf-8";
        await context.Response.SendFileAsync(appHtmlPath);
    }
    else
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("Wedding Tracker frontend niet gevonden.");
    }
});

app.Run();
