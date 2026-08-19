@echo off
REM ================================================================================================
REM  v6.74.5 - Ban .bat nay KHONG con chua ten tieng Viet nao.
REM  Ban truoc viet thang ten khach vao lenh -> cmd.exe doc file theo bang ma CU truoc khi
REM  chcp 65001 kip co tac dung -> moi ten tieng Viet deu vo ("'HIEN' is not recognized...").
REM  Nay danh sach nam trong utils\gop_npp.json va do NODE doc bang UTF-8 that su.
REM
REM      utils\gop_ten_khach_npp.bat            <- CHAY THU
REM      utils\gop_ten_khach_npp.bat --ghi      <- GHI THAT
REM ================================================================================================
node utils/gop_ten_khach.js --tu-file=utils/gop_npp.json %1
