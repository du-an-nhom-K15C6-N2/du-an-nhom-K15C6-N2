using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdmissionsLeadManagement.API.Models
{
    public class Lead
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(120)]
        public string FullName { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;

        [MaxLength(120)]
        public string? Email { get; set; }

        [MaxLength(150)]
        public string? MajorInterest { get; set; } // Ngành học quan tâm (CNTT, Kinh tế, Ngôn ngữ...)

        [MaxLength(255)]
        public string? Address { get; set; }

        public LeadStatus Status { get; set; } = LeadStatus.New;

        public LeadSource Source { get; set; } = LeadSource.Hotline;

        public int? AssignedCounselorId { get; set; }

        [ForeignKey(nameof(AssignedCounselorId))]
        public virtual Counselor? AssignedCounselor { get; set; }

        public DateTime CreatedDate { get; set; } = DateTime.UtcNow;

        /// <summary>
        /// Ngày trao đổi gần nhất. Cột này được lập chỉ mục (index) để tối ưu hóa truy vấn lọc thời gian.
        /// </summary>
        public DateTime? LastInteractionDate { get; set; }

        [MaxLength(1000)]
        public string? InitialNote { get; set; }

        public virtual ICollection<ConsultationNote> ConsultationNotes { get; set; } = new List<ConsultationNote>();
    }
}
