using Microsoft.EntityFrameworkCore;
using AdmissionsLeadManagement.API.Data;
using AdmissionsLeadManagement.API.Services;

var builder = WebApplication.CreateBuilder(args);

// 1. Đăng ký Controllers & Swagger/OpenAPI
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new()
    {
        Title = "Admissions Lead Management API",
        Version = "v1",
        Description = "API Quản lý & Lọc Lead dành cho Tư vấn Tuyển sinh"
    });
});

// 2. Cấu hình Database (Hỗ trợ In-Memory để chạy ngay lập tức trong Visual Studio hoặc SQL Server)
builder.Services.AddDbContext<AdmissionsDbContext>(options =>
{
    var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
    if (!string.IsNullOrEmpty(connectionString))
    {
        options.UseSqlServer(connectionString);
    }
    else
    {
        options.UseInMemoryDatabase("AdmissionsDb");
    }
});

// 3. Đăng ký Services & DI
builder.Services.AddScoped<ILeadService, LeadService>();

// 4. CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAll", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});

var app = builder.Build();

// 5. Seed dữ liệu mẫu khi khởi động
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<AdmissionsDbContext>();
    DbInitializer.Initialize(dbContext);
}

// 6. Cấu hình Middleware Pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Admissions Lead API v1");
    });
}

app.UseHttpsRedirection();
app.UseCors("AllowAll");

// Cho phép phục vụ giao diện tĩnh (HTML/CSS/JS)
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthorization();
app.MapControllers();

app.Run();
