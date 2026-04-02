document.addEventListener("DOMContentLoaded", () => {
  const data = JSON.parse(sessionStorage.getItem("registeredMember"));
  if (!data) return;

  // Mapping
  document.getElementById("m-date").innerText = data.timestamp;
  document.getElementById("m-id").innerText = data.id_number;
  document.getElementById("m-pic").src = data.picture;
  document.getElementById("m-first").innerText = `${data.first_name} ${
    data.suffix || ""
  }`;
  document.getElementById("m-middle").innerText = data.middle_name;
  document.getElementById("m-last").innerText = data.last_name;
  document.getElementById("m-gender").innerText = data.gender;
  document.getElementById("m-birth").innerText = data.birth_date;
  document.getElementById("m-addr").innerText = data.address;
  document.getElementById("m-brgy").innerText = data.barangay;
  document.getElementById("m-dist").innerText = data.district;
  document.getElementById("m-phone").innerText = data.phone_number;
  document.getElementById("m-email").innerText = data.email_add;
  document.getElementById("m-prec").innerText = data.precint_no;
  document.getElementById("m-ref").innerText = data.referrer;
  document.getElementById("o-name").innerText = `${data.first_name} ${
    data.middle_name
  } ${data.last_name} ${data.suffix || ""}`.trim();

  // Age logic
  const dob = data.birth_date.split("/");
  if (dob.length === 3) {
    const b = new Date(dob[2], dob[0] - 1, dob[1]);
    document.getElementById("m-age").innerText = Math.floor(
      (new Date() - b) / 31557600000
    );
  }
});

async function downloadPDF() {
  const btn = document.getElementById("dl-btn");
  const element = document.getElementById("pdf-content");
  btn.innerText = "Processing...";
  btn.disabled = true;

  const opt = {
    margin: 0,
    filename: "KBK_Member_Form.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false
    },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  try {
    // Generate PDF
    await html2pdf().set(opt).from(element).save();
  } catch (error) {
    console.error("PDF Fail:", error);
    alert(
      "Image security blocked the PDF. Please use the 'Print' button instead."
    );
  } finally {
    btn.innerText = "Download as PDF";
    btn.disabled = false;
  }
}
