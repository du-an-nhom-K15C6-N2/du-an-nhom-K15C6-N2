using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace AdmissionsLeadManagement.API.Models
{
    public class ConsultationNote
    {
        [Key]
        public int Id { get; set; }

        [Required]
        public int LeadId { get; set; }

        [ForeignKey(nameof(LeadId))]
        public virtual Lead? Lead { get; set; }

        [Required]
        public int CounselorId { get; set; }

        [ForeignKey(nameof(CounselorId))]
        public virtual Counselor? Counselor { get; set; }

        [Required]
        public DateTime InteractionDate { get; set; }

        public InteractionChannel Channel { get; set; } = InteractionChannel.PhoneCall;

        [Required]
        [MaxLength(2000)]
        public string Content { get; set; } = string.Empty;

        [MaxLength(500)]
        public string Outcome { get; set; } = string.Empty;

        public DateTime? NextAppointmentDate { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
