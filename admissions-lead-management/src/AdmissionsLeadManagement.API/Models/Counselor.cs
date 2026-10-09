using System.ComponentModel.DataAnnotations;

namespace AdmissionsLeadManagement.API.Models
{
    public class Counselor
    {
        [Key]
        public int Id { get; set; }

        [Required]
        [MaxLength(100)]
        public string FullName { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Email { get; set; } = string.Empty;

        [MaxLength(20)]
        public string PhoneNumber { get; set; } = string.Empty;

        [MaxLength(100)]
        public string Department { get; set; } = "Phòng Tuyển sinh";

        public bool IsActive { get; set; } = true;

        public virtual ICollection<Lead> AssignedLeads { get; set; } = new List<Lead>();
    }
}
