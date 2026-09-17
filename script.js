console.log("Hello JavaScript");

// alert() moved inside window.onload so it doesn't block page rendering
window.onload = function () {
    alert("Welcome to JavaScript");
};

let name1 = "Nirmal";
console.log(name1);
let age = 26;
let city = "Bangalore";
let isStudent = false;
console.log(age);
console.log(city);
console.log(isStudent);
age = 27;
console.log(age);

const country = "India";
console.log(country);

// String
let college = 'JIT';
let college1 = "JIT";
console.log(college);
console.log(college1);

// Number
let a = 5;
let b = 5.6;
let c = 56.89;
console.log(a);
console.log(b);
console.log(c);

// Boolean
let isTrue = true;
let isFalse = false;
console.log(isTrue);
console.log(isFalse);

// undefined
let address;
console.log(address);

// null
let phone = null;
console.log(phone);

// Symbol
let uniqueId = Symbol("id");
console.log(uniqueId);

// Object
let Student = {
    name2: "Nikhil",
    age: 25,
    course: "MERN Stack"
};
console.log(Student);

// BigInt — must use 'n' suffix for BigInt literals
let bigNumber = 123456789123456789123456789n;
console.log(bigNumber);

// typeof
console.log(typeof name1);
console.log(typeof college);
console.log(typeof null); // Note: typeof null returns "object" — this is a known JS quirk

// Arithmetic Operators
let a1 = 10;
let b1 = 3;
console.log(a1 + b1);
console.log(a1 - b1);
console.log(a1 * b1);
console.log(a1 / b1);
console.log(a1 % b1);

// Comparison Operators
console.log(a1 > b1);
console.log(a1 < b1);
console.log(a1 >= b1);
console.log(a1 <= b1);
console.log(a1 == b1);
console.log(a1 != b1);

// Strict equality (===) vs loose equality (==)
console.log(5 == "5");   // true  — type coercion
console.log(5 === "5");  // false — no type coercion

// Logical Operators
console.log(true && false);  // AND
console.log(true || false);  // OR
console.log(!true);          // NOT
