using System.ComponentModel.DataAnnotations;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using AdmissionsLeadManagement.API.Data;
using AdmissionsLeadManagement.API.DTOs;
using AdmissionsLeadManagement.API.Models;
using AdmissionsLeadManagement.API.Services;
using Xunit;

namespace AdmissionsLeadManagement.Tests
{
    public class LeadServiceTests
    {
        private AdmissionsDbContext CreateInMemoryDbContext()
        {
            var options = new DbContextOptionsBuilder<AdmissionsDbContext>()
                .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
                .Options;

            var context = new AdmissionsDbContext(options);

            // Seed dữ liệu mẫu với thời gian giả lập
            var counselor1 = new Counselor { Id = 1, FullName = "Nguyễn Thuỳ Linh", Department = "Tuyển sinh CNTT" };
            var counselor2 = new Counselor { Id = 2, FullName = "Lê Hoàng Long", Department = "Tuyển sinh Kinh tế" };
            context.Counselors.AddRange(counselor1, counselor2);

            var now = DateTime.Now;
            var lastMonth = now.AddMonths(-1);

            // Lead 1: Trao đổi vào THÁNG TRƯỚC (Hỏi học bổng IELTS)
            var lead1 = new Lead
            {
                Id = 1,
                FullName = "Nguyễn Văn Hùng",
                PhoneNumber = "0912345678",
                Email = "hung.nguyen@test.com",
                MajorInterest = "Kỹ thuật Phần mềm",
                Status = LeadStatus.CallAgainLater,
                Source = LeadSource.Hotline,
                AssignedCounselorId = 1,
                CreatedDate = lastMonth.AddDays(-10),
                LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 0, 0),
                ConsultationNotes = new List<ConsultationNote>
                {
                    new ConsultationNote
                    {
                        Id = 1,
                        CounselorId = 1,
                        InteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 15, 14, 0, 0),
                        Content = "Phụ huynh hỏi về học bổng IELTS 6.5 và học phí kỳ 1.",
                        Outcome = "Hẹn tháng sau liên hệ lại khi con thi tốt nghiệp xong."
                    }
                }
            };

            // Lead 2: Trao đổi vào THÁNG NÀY (Hôm qua)
            var lead2 = new Lead
            {
                Id = 2,
                FullName = "Trần Thị Mai Anh",
                PhoneNumber = "0988776655",
                Email = "maianh@test.com",
                MajorInterest = "Truyền thông Đa phương tiện",
                Status = LeadStatus.Consulting,
                Source = LeadSource.FacebookAds,
                AssignedCounselorId = 1,
                CreatedDate = now.AddDays(-10),
                LastInteractionDate = now.AddDays(-1),
                ConsultationNotes = new List<ConsultationNote>
                {
                    new ConsultationNote
                    {
                        Id = 2,
                        CounselorId = 1,
                        InteractionDate = now.AddDays(-1),
                        Content = "Tư vấn chương trình đồ họa 3D qua Zalo.",
                        Outcome = "Đã gửi tài liệu."
                    }
                }
            };

            // Lead 3: Lead thuộc về Counselor 2, Nguồn GoogleSearch
            var lead3 = new Lead
            {
                Id = 3,
                FullName = "Phạm Quốc Tuấn",
                PhoneNumber = "0901234987",
                Email = "tuan.pq@test.com",
                MajorInterest = "Quản trị Kinh doanh",
                Status = LeadStatus.ScheduledAppointment,
                Source = LeadSource.GoogleSearch,
                AssignedCounselorId = 2,
                CreatedDate = lastMonth.AddDays(-5),
                LastInteractionDate = new DateTime(lastMonth.Year, lastMonth.Month, 25, 10, 0, 0)
            };

            context.Leads.AddRange(lead1, lead2, lead3);
            context.SaveChanges();

            return context;
        }

        [Fact]
        public async Task FilterLeads_ByLastMonth_ReturnsOnlyLeadsContactedInLastMonth()
        {
            // Arrange: Yêu cầu của Tư vấn tuyển sinh - "tìm lại được cuộc trao đổi từ tháng trước khi khách gọi lại"
            using var context = CreateInMemoryDbContext();
            var service = new LeadService(context, NullLogger<LeadService>.Instance);

            var query = new LeadFilterQuery
            {
                QuickTimeRange = QuickTimeRangeOption.LastMonth,
                DateFilterType = DateFilterType.LastInteractionDate
            };

            // Act
            var result = await service.SearchAndFilterLeadsAsync(query);

            // Assert: Lead 1 và Lead 3 có cuộc trao đổi vào tháng trước, Lead 2 trao đổi hôm qua (tháng này)
            Assert.NotNull(result);
            Assert.Equal(2, result.TotalCount);
            Assert.Contains(result.Items, item => item.Id == 1);
            Assert.Contains(result.Items, item => item.Id == 3);
            Assert.DoesNotContain(result.Items, item => item.Id == 2);
        }

        [Fact]
        public async Task SearchLeads_ByPhoneNumber_WhenCustomerCallsBack_ReturnsInstantMatch()
        {
            // Arrange: Khi phụ huynh hoặc học sinh gọi lại hotline
            using var context = CreateInMemoryDbContext();
            var service = new LeadService(context, NullLogger<LeadService>.Instance);

            var query = new LeadFilterQuery
            {
                Keyword = "0912345678" // Số điện thoại của Lead 1
            };

            // Act
            var result = await service.SearchAndFilterLeadsAsync(query);

            // Assert: Tìm thấy ngay chính xác Lead 1 cùng nội dung trao đổi cũ
            Assert.Single(result.Items);
            var lead = result.Items[0];
            Assert.Equal("Nguyễn Văn Hùng", lead.FullName);
            Assert.NotNull(lead.LatestInteraction);
            Assert.Contains("học bổng IELTS 6.5", lead.LatestInteraction.Content);
        }

        [Fact]
        public async Task SearchLeads_ByPastConsultationKeyword_ReturnsMatchingLead()
        {
            // Arrange: Khách gọi lại nói: "Tôi là người hôm trước hỏi về học bổng IELTS 6.5"
            using var context = CreateInMemoryDbContext();
            var service = new LeadService(context, NullLogger<LeadService>.Instance);

            var query = new LeadFilterQuery
            {
                Keyword = "IELTS 6.5"
            };

            // Act
            var result = await service.SearchAndFilterLeadsAsync(query);

            // Assert: Khớp theo nội dung lịch sử cuộc trao đổi (ConsultationNotes)
            Assert.Single(result.Items);
            Assert.Equal(1, result.Items[0].Id);
        }

        [Fact]
        public async Task FilterLeads_ByMultipleConditions_Status_Source_Counselor()
        {
            // Arrange: Lọc đa điều kiện: Trạng thái CallAgainLater + Nguồn Hotline + Chuyên viên ID 1
            using var context = CreateInMemoryDbContext();
            var service = new LeadService(context, NullLogger<LeadService>.Instance);

            var query = new LeadFilterQuery
            {
                Status = LeadStatus.CallAgainLater,
                Source = LeadSource.Hotline,
                CounselorId = 1
            };

            // Act
            var result = await service.SearchAndFilterLeadsAsync(query);

            // Assert
            Assert.Single(result.Items);
            Assert.Equal(1, result.Items[0].Id);
            Assert.Equal(LeadStatus.CallAgainLater, result.Items[0].Status);
            Assert.Equal(LeadSource.Hotline, result.Items[0].Source);
            Assert.Equal(1, result.Items[0].AssignedCounselorId);
        }

        [Fact]
        public void NormalizeQuery_WhenFromDateGreaterThanToDate_FailsValidation()
        {
            // Arrange: Test kiểm tra tính hợp lệ của tham số truy vấn thời gian
            var query = new LeadFilterQuery
            {
                QuickTimeRange = QuickTimeRangeOption.Custom,
                FromDate = new DateTime(2026, 5, 10),
                ToDate = new DateTime(2026, 5, 1) // Lỗi: Ngày bắt đầu lớn hơn ngày kết thúc
            };

            var validationContext = new ValidationContext(query);
            var validationResults = new List<ValidationResult>();

            // Act
            var isValid = Validator.TryValidateObject(query, validationContext, validationResults, true);

            // Assert
            Assert.False(isValid);
            Assert.Contains(validationResults, v => v.ErrorMessage!.Contains("không được lớn hơn"));
        }

        [Fact]
        public async Task FilterLeads_PaginationAndSorting_ReturnsCorrectPageSize()
        {
            // Arrange
            using var context = CreateInMemoryDbContext();
            var service = new LeadService(context, NullLogger<LeadService>.Instance);

            var query = new LeadFilterQuery
            {
                PageNumber = 1,
                PageSize = 2,
                SortBy = "LastInteractionDate",
                SortDescending = true
            };

            // Act
            var result = await service.SearchAndFilterLeadsAsync(query);

            // Assert
            Assert.Equal(3, result.TotalCount);
            Assert.Equal(2, result.Items.Count);
            Assert.True(result.HasNextPage);
            // Bản ghi đầu tiên phải là Lead có cuộc trao đổi mới nhất (Lead 2 - hôm qua)
            Assert.Equal(2, result.Items[0].Id);
        }
    }
}
