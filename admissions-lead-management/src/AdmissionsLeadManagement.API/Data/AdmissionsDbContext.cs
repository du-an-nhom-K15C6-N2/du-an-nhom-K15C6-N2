using Microsoft.EntityFrameworkCore;
using AdmissionsLeadManagement.API.Models;

namespace AdmissionsLeadManagement.API.Data
{
    public class AdmissionsDbContext : DbContext
    {
        public AdmissionsDbContext(DbContextOptions<AdmissionsDbContext> options) : base(options)
        {
        }

        public DbSet<Lead> Leads => Set<Lead>();
        public DbSet<ConsultationNote> ConsultationNotes => Set<ConsultationNote>();
        public DbSet<Counselor> Counselors => Set<Counselor>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Tối ưu hoá Index cho tìm kiếm & lọc Lead
            modelBuilder.Entity<Lead>(entity =>
            {
                // 1. Index tra cứu nhanh khi khách gọi lại theo SĐT
                entity.HasIndex(l => l.PhoneNumber)
                      .HasDatabaseName("IX_Leads_PhoneNumber");

                // 2. Index tối ưu lọc theo thời gian trao đổi gần nhất
                entity.HasIndex(l => l.LastInteractionDate)
                      .HasDatabaseName("IX_Leads_LastInteractionDate");

                // 3. Index tối ưu lọc theo ngày tiếp nhận
                entity.HasIndex(l => l.CreatedDate)
                      .HasDatabaseName("IX_Leads_CreatedDate");

                // 4. Composite Index tối ưu bộ lọc đa điều kiện: Người phụ trách + Trạng thái + Thời gian
                entity.HasIndex(l => new { l.AssignedCounselorId, l.Status, l.LastInteractionDate })
                      .HasDatabaseName("IX_Leads_Counselor_Status_InteractionDate");

                // 5. Composite Index cho Nguồn + Trạng thái
                entity.HasIndex(l => new { l.Source, l.Status })
                      .HasDatabaseName("IX_Leads_Source_Status");

                // Quan hệ Lead - Counselor
                entity.HasOne(l => l.AssignedCounselor)
                      .WithMany(c => c.AssignedLeads)
                      .HasForeignKey(l => l.AssignedCounselorId)
                      .OnDelete(DeleteBehavior.SetNull);
            });

            // Quan hệ ConsultationNote - Lead & Counselor
            modelBuilder.Entity<ConsultationNote>(entity =>
            {
                // Index tra cứu lịch sử trao đổi theo Lead và Thời gian trao đổi
                entity.HasIndex(cn => new { cn.LeadId, cn.InteractionDate })
                      .HasDatabaseName("IX_ConsultationNotes_LeadId_InteractionDate");

                entity.HasOne(cn => cn.Lead)
                      .WithMany(l => l.ConsultationNotes)
                      .HasForeignKey(cn => cn.LeadId)
                      .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(cn => cn.Counselor)
                      .WithMany()
                      .HasForeignKey(cn => cn.CounselorId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
