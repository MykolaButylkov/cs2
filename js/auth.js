const phoneInput = document.getElementById("phoneIL");
const phoneFull = document.getElementById("phoneFull");

if (phoneInput && phoneFull) {
  phoneInput.addEventListener("input", function () {

    // Оставляем только цифры
    let digits = this.value.replace(/\D/g, "");

    // Ограничиваем длину (10 цифр максимум)
    if (digits.length > 10) {
      digits = digits.slice(0, 10);
    }

    this.value = digits;

    // Если начинается с 0 — убираем его
    if (digits.startsWith("0")) {
      digits = digits.substring(1);
    }

    // Записываем международный формат
    phoneFull.value = "+972" + digits;
  });
}
