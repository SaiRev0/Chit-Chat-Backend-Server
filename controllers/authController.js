const jwt = require("jsonwebtoken");
const filterObj = require("../utils/filterObj");

// Model
const User = require("../models/user");
const { promisify } = require("util");
const catchAsync = require("../utils/catchAsync");

const signToken = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET);

exports.register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password } = req.body;
  const avatar = `https://ui-avatars.com/api/?rounded=true&format=svg&bold=true&name=${firstName}+${lastName}`;

  const filteredBody = filterObj(
    req.body,
    "firstName",
    "lastName",
    "email",
    "password"
  );

  filteredBody.avatar = avatar;

  const existing_user = await User.findOne({ email: email });

  if (existing_user) {
    return res.status(400).json({
      status: "error",
      message: "Email already in use, Please login.",
    });
  } else {
    const new_user = await User.create(filteredBody);
    req.userId = new_user._id;

    const token = signToken(new_user._id);

    res.status(200).json({
      status: "success",
      message: "Registered in successfully!",
      token,
      user_id: new_user._id,
    });
  }
});

exports.login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({
      status: "error",
      message: "Both email and password are required",
    });
    return;
  }

  const user = await User.findOne({ email: email }).select("+password");

  if (!user || !user.password) {
    res.status(400).json({
      status: "error",
      message: "Incorrect password",
    });

    return;
  }

  if (!user || !(await user.correctPassword(password, user.password))) {
    res.status(400).json({
      status: "error",
      message: "Email or password is incorrect",
    });

    return;
  }

  const token = signToken(user._id);

  res.status(200).json({
    status: "success",
    message: "Logged in successfully!",
    token,
    user_id: user._id,
  });
});

exports.protect = catchAsync(async (req, res, next) => {
  // 1) Getting token and check if it's there
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.jwt) {
    token = req.cookies.jwt;
  }

  if (!token) {
    return res.status(401).json({
      message: "You are not logged in! Please log in to get access.",
    });
  }
  // 2) Verification of token
  const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

  // 3) Check if user still exists

  const this_user = await User.findById(decoded.userId);
  if (!this_user) {
    return res.status(401).json({
      message: "The user belonging to this token does no longer exists.",
    });
  }

  // GRANT ACCESS TO PROTECTED ROUTE
  req.user = this_user;
  next();
});
