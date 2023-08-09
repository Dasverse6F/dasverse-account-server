const express = require('express');
const User = require('../models/user');
const bodyParser = require('body-parser');
const app = express();
const router = express.Router();
const { v1: uuidv1 } = require('uuid');

app.use(bodyParser.json());

const nicknameRegex1 = /^[\uAC00-\uD7A3]{2,8}$/;
const nicknameRegex2 = /^[a-zA-Z]{4,12}$/;
const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+-={}[\]|;:'"<>,.?/])\S{8,16}$/;
const phoneRegex = /^010\d{8}$/;
const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const nameRegex = /^[\uAC00-\uD7A3]{1,27}$/;

// 회원가입 라우트 C
router.post('/signup',async (req, res) => {
  try {
    const { email, password, nickname, name, phone } = req.body; //HTTP Request의 Body에서 추출 *객체구조 분해* 이용
    //정규표현식 체크
    if (!validationCheck(res, email, password, nickname, name, phone)) {
      return;
    }
    //중복 체크
    if (await User.findOne({ where: { email: email } })) {
      res.status(500).json({flag:"C", status:"E", result_message:"이미 존재하는 유저입니다."});
      console.log("duplicate error");
      return;
    }
    const UUID = uuidv1();
    const user = await User.create({ UUID: UUID, email: email, password: password, nickname: nickname, name: name, phone: phone }); //await User.create 메소드를 통해 DB에 접근하여 INSERT
    res.status(201).json({userUUID: UUID, status: "S" , result_message: "회원가입이 완료되었습니다.", flag:"C"}); //HTTP response 클라이언트에게 송신
  } catch (error) {
    res.status(500).json({ flag:"C", error_message: error.toString(), status: "E", result_message: "에러가 발생했습니다." });
    console.log(error);
  }
});

// 로그인 라우트 R
router.post('/signin',async (req, res) => { 
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email: email } });
    if (!user || !(await user.verifyPassword(password)) || user.status == "0") { //유저 없거나 비밀번호 일치하지 않거나 탈퇴한 회원 일 경우
      res.status(401).json({ flag:"R", result_message: "유저가 존재하지 않거나 비밀번호가 일치하지 않습니다.", status: "E" }); //에러 처리

    } else {
      res.status(200).json({ flag:"R", userUUID: user.UUID, status: "S", result_message: "로그인 성공!" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ flag:"R", error_message: error.toString(), status: "E", result_message:"에러가 발생했습니다." });
  }
});

//회원탈퇴 라우트 D
router.post('/delete',async (req, res) => {
  try {
    const { email, password, status } = req.body;
    const user = await User.findOne({ where: { email: email } }); //회원 탈퇴할 회원 조회 (email 기준)

    if (!user || !(await user.verifyPassword(password))) { //유저 없거나 비밀번호 일치하지 않는 경우
      res.status(401).json({ flag:"D", result_message: "유저가 존재하지 않거나 비밀번호가 일치하지 않습니다.", status: "E" });

    } else {
      const user_result = await User.update({ status: "0", mod_date: now }, { where: { email } }); //해당 회원의 상태를 탈퇴로 변경
      res.json({ flag:"D", user: user_result, status: "S" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ flag:"D", error_message: error.toString(), status: "E",result_message:"에러가 발생했습니다."  });
  }
});

//정보 수정 라우트 U
router.post('/put',async (req, res) => {
  try {
    const now = require('../custom_modules/nowDate'); //커스텀 모듈을 이용해 현재 시간 불러옴
    const { email, password, nickname, name, phone } = req.body;
    const user = await User.findOne({ where: { email: email } }); //email 기준으로 정보 수정 할 유저 DB에서 찾아와서 인스턴스화(Users 모델)

    if (!user) { //유저가 없는경우
      res.status(401).json({ flag:"U", result_message: "유저가 존재하지않습니다.", status: "E" });

    } else {
      /* const updatedUser = { UUID: user.UUID, email: email, password: password, nickname: nickname, name: name, phone: phone, mod_date: now }; //UPDATE된 유저 결과를 보여주기 위한 객체 */
      const userCount = await User.update({ pasword: password, nickname: nickname, name: name, phone: phone, mod_date: now }, { where: { UUID: user.UUID } });  //DB접근 (user UUID를 기준으로 데이터 UPDATE)
      const updatedUser = await User.findOne({ where: { UUID: user.UUID } }); //UPDATE된 유저 결과를 보여주기 위한 객체
      res.json({ flag:"U", count: userCount, update_result_user: updatedUser, status: "S", result_message:"정보 수정이 정상적으로 진행됐습니다." }); //UPDATE결과 HTTP response로 전송
    }
  } catch (error) {
    console.log(error); 
    res.status(500).json({ flag:"U", error_message: error.toString(), status: "E", result_message:"에러가 발생했습니다."});
  }
});


//중복 체크 라우트 CK
router.post('/check',async (req, res) => {
  try {
    let check_flag = "";
    const { email, nickname, phone, header } = req.body;
    let user = null;
    if (header == "email" && email) { //이메일 체크
      check_flag = "이메일";
      user = await User.findOne({ where: { email: email } }); 
    } else if (header == "nickname" && nickname) { //닉네임 체크
      check_flag = "닉네임";
      user = await User.findOne({ where: { nickname: nickname } }); 
    } else if (header == "phone" && phone){ // 전화번호 체크
      check_flag = "전화번호";
      cuser = await User.findOne({ where: { phone: phone } }); 
    }
    
    if (!user) { //유저가 없는경우
      res.status(200).json({ flag:"CK",status: "S", result_message: "사용가능한 "+check_flag+" 입니다."});
    } else {
      res.status(401).json({ flag:"CK", result_message: check_flag+"(이)가 중복됩니다.", status: "E" });
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ flag:"CK", result_message: error.toString(), status: "E" });
  }
});
module.exports = router;

function validationCheck(res, email, password, nickname, name, phone) {
  if (!nicknameRegex1.test(nickname) && !nicknameRegex2.test(nickname)) {
    res.status(400).json({flag: "C", status: "E", result_message: "닉네임은 한글 2~8자, 영어4~12자만 허용됩니다."})
    return false;
  } 
  if (!passwordRegex.test(password)) {
    res.status(400).json({flag: "C",status: "E", result_message: "비밀번호는 영어 대문자, 특수기호 포함 8~16자만 허용됩니다."})
    return false;
  }
  if (!phoneRegex.test(phone)) {
    res.status(400).json({flag: "C",status: "E", result_message: "전화번호는 번호만 입력해주세요."})
    return false;
  }
  if (!emailRegex.test(email)) {
    res.status(400).json({flag: "C",status: "E", result_message: "올바른 이메일 형식을 사용해주세요"})
    return false;
  } 
  if (!nameRegex.test(name)) {
    res.status(400).json({flag: "C", status: "E", result_message: "정상적인 이름을 작성해주세요"})
    return false;
  }
  console.log("error");
  return true;
}

//TODO
//위 모든 체크의 결과에 따른 반환 값 달라지게 하기
    //그리고 그냥 출력만 하면 됨